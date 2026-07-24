/**
 * Consolidates the 4 `corporations` rows that were duplicated as a
 * workaround for a UI limitation: a company with multiple physical
 * locations needs a separate Sales Tax certificate (and ticket) per
 * location, but staff had no way to create a second ticket for the same
 * corporation, so they created a whole second corporation row (same EIN, a
 * different DBA name) just to get a second ticket path. That gap is now
 * fixed (`corporate_pipeline_tickets.certificate_id` + the client-side
 * duplicate-check now key on certificate, not just corporation+service — see
 * CorporateClientIntake.tsx / CorporateServicesPipeline.tsx), so these 4
 * pairs can be folded back into one corporation each, with the location
 * distinction preserved on `sales_tax_certificates` instead of on a whole
 * duplicated corporation row.
 *
 * These pairs are a one-time, human-confirmed judgment call (the user
 * identified them from the `dedupe-corporations.ts` NEEDS REVIEW list) —
 * unlike that script's EIN/name-based auto-detection, this list is
 * hardcoded and not meant to be re-derived automatically.
 *
 * Per pair:
 * - Keeper is picked the same way dedupe-corporations.ts does (richer
 *   related-row count wins, oldest breaks ties).
 * - If the loser has exactly one sales_tax_certificates row, that
 *   certificate is backfilled with the loser's own address/city/state/zip
 *   (so the location's address isn't lost once the loser corporation row is
 *   gone), and every one of the loser's corporate_pipeline_tickets rows gets
 *   certificate_id set to it — preserving "this ticket is for this location"
 *   after the merge. Zero or multiple certificates: left alone, logged as a
 *   warning for manual follow-up.
 * - All FK-linked tables (including the now-addressed certificate) are
 *   repointed to the keeper, and documents.client_code is repointed since
 *   documents links by that text field, not a FK.
 * - The loser's company name is appended to the keeper's notes so the
 *   second DBA isn't silently lost at the corporation level (each
 *   certificate's own company_name column already preserves it too).
 * - Skipped if keeper and loser both currently hold an active billing
 *   bundle (would violate the one-active-bundle-per-corporation constraint).
 *
 * Usage:
 *   bun run packages/server/scripts/consolidate-multilocation-corporations.ts           # report only
 *   bun run packages/server/scripts/consolidate-multilocation-corporations.ts --apply   # write changes
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, isNull } from 'drizzle-orm';
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

const { corporations, salesTaxCertificates, corporatePipelineTickets } = schema;

const PAIRS: [string, string][] = [
  ['recAstWkodonQFiDC', 'recNMH67cKF3UhutF'], // LANALEKU LLC / LA CHATEAU PROPERTIES LLC
  ['recjf42LPqcFeOmxK', 'recKDcJ9Cmqc1fBRY'], // EL SITIO COFFEE BAR INC / Sitio Bar Grill
  ['recNMilJurD4vCDCg', 'recRMEaByfOXOnhOQ'], // FLOAT-A-PHONE PRO LLC / LISMIN SERVICES LLC
  ['rec5zzlDZz9HWoSfP', 'recStakwkV67zVZj2'], // VAMEL CORPORATION / VAMEL CORPORATION (terreno)
];

async function main() {
  console.log(`\nConsolidating ${PAIRS.length} confirmed multi-location pair(s).\n`);

  let consolidated = 0;
  let skippedBundleConflict = 0;
  let skippedMissing = 0;

  for (const [idA, idB] of PAIRS) {
    console.log('----------------------------------------');
    const rows = await db.select().from(corporations).where(eq(corporations.id, idA));
    const rowsB = await db.select().from(corporations).where(eq(corporations.id, idB));
    const rowA = rows[0];
    const rowB = rowsB[0];

    if (!rowA || !rowB) {
      console.log(`  -> SKIPPED: ${idA} or ${idB} not found (already merged, or ids stale).`);
      skippedMissing++;
      continue;
    }

    const [scoreA, scoreB] = await Promise.all([
      relatedRowCount(db, rowA.id, rowA.clientCode),
      relatedRowCount(db, rowB.id, rowB.clientCode),
    ]);
    const [keeper, keeperScore, loser] =
      scoreA > scoreB || (scoreA === scoreB && (rowA.createdAt?.getTime() ?? 0) <= (rowB.createdAt?.getTime() ?? 0))
        ? [rowA, scoreA, rowB]
        : [rowB, scoreB, rowA];

    console.log(`  keeper: ${keeper.id} "${keeper.company}" (score=${keeperScore})`);
    console.log(`  merge-away: ${loser.id} "${loser.company}"`);

    if ((await hasActiveBundle(db, keeper.id)) && (await hasActiveBundle(db, loser.id))) {
      console.log(`  -> SKIPPED: both ${keeper.id} and ${loser.id} have an active billing bundle; resolve by hand.`);
      skippedBundleConflict++;
      continue;
    }

    const loserCerts = await db
      .select()
      .from(salesTaxCertificates)
      .where(eq(salesTaxCertificates.corporationId, loser.id));

    let certToBackfill: (typeof loserCerts)[number] | null = null;
    if (loserCerts.length === 1) {
      certToBackfill = loserCerts[0];
      console.log(
        `  will backfill certificate ${certToBackfill.id} with ${loser.company}'s address, and point its tickets at it`
      );
    } else {
      console.log(
        `  -> WARNING: loser has ${loserCerts.length} certificate(s) (expected exactly 1) — tickets' certificate_id left null, review manually.`
      );
    }

    if (loser.clientCode && keeper.clientCode && loser.clientCode !== keeper.clientCode) {
      console.log(`  documents.client_code will be repointed: ${loser.clientCode} -> ${keeper.clientCode}`);
    }
    console.log(`  keeper.notes will note "Also operates as: ${loser.company}"`);

    if (!isApply) {
      console.log('  [dry-run] no changes written.');
      consolidated++;
      continue;
    }

    await db.transaction(async (tx) => {
      if (certToBackfill) {
        await tx
          .update(salesTaxCertificates)
          .set({
            address: certToBackfill.address ?? loser.address,
            city: certToBackfill.city ?? loser.city,
            state: certToBackfill.state ?? loser.state,
            zip: certToBackfill.zip ?? loser.zip,
          })
          .where(eq(salesTaxCertificates.id, certToBackfill.id));

        const ticketResult = await tx
          .update(corporatePipelineTickets)
          .set({ certificateId: certToBackfill.id })
          .where(and(eq(corporatePipelineTickets.corporationId, loser.id), isNull(corporatePipelineTickets.certificateId)));
        const rowCount = (ticketResult as { rowCount?: number }).rowCount;
        if (rowCount) {
          console.log(`    backfilled certificate_id on ${rowCount} ticket(s)`);
        }
      }

      await repointForeignKeys(tx, keeper.id, loser.id);
      await repointDocuments(tx, keeper.clientCode, loser.clientCode);

      const mergeNote = `Also operates as: ${loser.company} (merged from ${loser.id} on ${new Date().toISOString().slice(0, 10)})`;
      await tx
        .update(corporations)
        .set({ notes: keeper.notes ? `${keeper.notes}\n${mergeNote}` : mergeNote })
        .where(eq(corporations.id, keeper.id));

      await tx.delete(corporations).where(eq(corporations.id, loser.id));
      console.log(`    deleted ${loser.id}`);
    });
    consolidated++;
  }

  console.log('\n========== CONSOLIDATION REPORT ==========');
  console.log(`pairs configured           : ${PAIRS.length}`);
  console.log(`consolidated${isApply ? '' : ' (dry-run)'}              : ${consolidated}`);
  console.log(`skipped - bundle conflict  : ${skippedBundleConflict}`);
  console.log(`skipped - missing row(s)   : ${skippedMissing}`);
  console.log('============================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Consolidation failed:', err);
  process.exit(1);
});
