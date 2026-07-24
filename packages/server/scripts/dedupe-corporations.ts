/**
 * Finds and merges duplicate `corporations` rows — the same company entered
 * twice in Airtable under slightly different casing/EIN-formatting, carried
 * over as-is by the migration ETL. Duplicates are detected by EIN, normalized
 * to digits-only so "39-4567263" and "394567263" match; groups where the
 * normalized EIN is empty or the literal placeholder "NONE" are excluded —
 * those are missing-client-code collisions, not duplicate entities, and must
 * not be merged.
 *
 * `documents` links to `corporations` by `client_code` (plain text, no FK —
 * see packages/server/src/db/schema/documents.ts), so merging also rewrites
 * documents.client_code from the loser's code to the keeper's. Every other
 * corporation-linked table uses a real FK and is repointed accordingly.
 * `billing_records.client_name` is deliberately left untouched — it's a
 * stored historical value, not a lookup (see subscriptions.ts), so it should
 * keep reading whatever name was actually billed under at the time.
 *
 * Safety:
 * - Default is a dry run — a full report, zero writes. Pass --apply to write.
 * - A group is only ever auto-merged if the company names match after
 *   normalization (case/whitespace/trailing-punctuation only). Anything else
 *   (e.g. "VAMEL CORPORATION" vs "VAMEL CORPORATION (terreno)") is reported
 *   as NEEDS REVIEW and never merged, even with --apply.
 * - If keeper and loser both have an active billing bundle, that group is
 *   skipped (would violate the one-active-bundle-per-corporation constraint)
 *   and must be resolved by hand.
 * - Each group's repoint + delete runs in a single transaction.
 *
 * Usage:
 *   bun run packages/server/scripts/dedupe-corporations.ts           # report only
 *   bun run packages/server/scripts/dedupe-corporations.ts --apply   # write changes
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { relatedRowCount, hasActiveBundle, repointForeignKeys, repointDocuments } from './lib/corporation-merge-helpers';

config({ path: resolve(__dirname, '../.env') });

const isApply = process.argv.includes('--apply');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (packages/server/.env)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('.render.com') ? { rejectUnauthorized: false } : false,
});
const db = drizzle(pool, { schema });

const { corporations } = schema;

function normalizeEin(ein: string | null): string {
  if (!ein) return '';
  return ein.replace(/\D/g, '');
}

function normalizeCompanyName(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // drop parenthetical suffixes like "(terreno)"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type Corp = typeof corporations.$inferSelect;

interface Group {
  normalizedEin: string;
  rows: Corp[];
}

async function findDuplicateGroups(): Promise<Group[]> {
  const all = await db.select().from(corporations);
  const byEin = new Map<string, Corp[]>();
  for (const row of all) {
    const norm = normalizeEin(row.ein);
    if (!norm || norm.replace(/0/g, '') === '') continue; // skip blank/all-zero placeholders
    const list = byEin.get(norm) ?? [];
    list.push(row);
    byEin.set(norm, list);
  }
  const groups: Group[] = [];
  for (const [normalizedEin, rows] of byEin) {
    if (rows.length > 1) groups.push({ normalizedEin, rows });
  }
  return groups;
}

async function main() {
  const groups = await findDuplicateGroups();
  console.log(`\nFound ${groups.length} duplicate-EIN group(s).\n`);

  let merged = 0;
  let skippedReview = 0;
  let skippedBundleConflict = 0;

  for (const group of groups) {
    const namesMatch = new Set(group.rows.map((r) => normalizeCompanyName(r.company))).size === 1;

    console.log('----------------------------------------');
    console.log(`EIN (normalized): ${group.normalizedEin}`);
    for (const row of group.rows) {
      console.log(`  ${row.id}  "${row.company}"  client_code=${row.clientCode}  ein=${row.ein}  created=${row.createdAt}`);
    }

    if (!namesMatch) {
      console.log('  -> NEEDS REVIEW: company names differ beyond case/punctuation. Not auto-merged.');
      skippedReview++;
      continue;
    }

    // Rank by related-row count (richer record wins), tie-break oldest first.
    const scored = await Promise.all(
      group.rows.map(async (row) => ({
        row,
        score: await relatedRowCount(db, row.id, row.clientCode),
      }))
    );
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.row.createdAt?.getTime() ?? 0) - (b.row.createdAt?.getTime() ?? 0);
    });
    const keeper = scored[0].row;
    const losers = scored.slice(1).map((s) => s.row);

    console.log(`  suggested keeper: ${keeper.id} (score=${scored[0].score})`);
    for (const s of scored.slice(1)) {
      console.log(`  suggested merge-away: ${s.row.id} (score=${s.score})`);
    }

    if (losers.some((l) => l.clientCode && keeper.clientCode && l.clientCode !== keeper.clientCode)) {
      console.log(
        `  documents.client_code will be repointed: ${losers.map((l) => l.clientCode).join(', ')} -> ${keeper.clientCode}`
      );
    }

    let bundleConflict = false;
    for (const loser of losers) {
      if ((await hasActiveBundle(db, keeper.id)) && (await hasActiveBundle(db, loser.id))) {
        console.log(
          `  -> SKIPPED: both ${keeper.id} and ${loser.id} have an active billing bundle; resolve by hand.`
        );
        bundleConflict = true;
      }
    }
    if (bundleConflict) {
      skippedBundleConflict++;
      continue;
    }

    if (!isApply) {
      console.log('  [dry-run] no changes written.');
      merged++;
      continue;
    }

    await db.transaction(async (tx) => {
      for (const loser of losers) {
        await repointForeignKeys(tx, keeper.id, loser.id);
        await repointDocuments(tx, keeper.clientCode, loser.clientCode);
        await tx.delete(corporations).where(eq(corporations.id, loser.id));
        console.log(`    deleted ${loser.id}`);
      }
    });
    merged++;
  }

  console.log('\n========== DEDUPE REPORT ==========');
  console.log(`groups found              : ${groups.length}`);
  console.log(`merged${isApply ? '' : ' (dry-run)'}                   : ${merged}`);
  console.log(`skipped - needs review    : ${skippedReview}`);
  console.log(`skipped - bundle conflict : ${skippedBundleConflict}`);
  console.log('====================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Dedupe failed:', err);
  process.exit(1);
});
