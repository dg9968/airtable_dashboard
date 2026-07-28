/**
 * Backfills the auto-created follow-up ticket (Tax Returns / Tax Prep
 * Pipeline) for extension tickets that were already marked Filed before
 * that auto-linking existed (see src/lib/extension-followup.ts). Without
 * this, only extensions filed (or re-saved) after that feature shipped show
 * up on the /extension-followups dashboard.
 *
 * Finds every corporate_pipeline_tickets / personal_pipeline_tickets row
 * with extension_status = 'Filed' and no linked follow-up ticket yet, and
 * runs the same ensureCorporateExtensionFollowUp / ensurePersonalExtensionFollowUp
 * logic used by the live PATCH /api/extensions[-personal] routes, so the
 * created ticket and due-date math are identical either way.
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - With --apply, requires typing "yes" at a single confirmation prompt.
 * - Each ticket's follow-up creation runs in its own transaction.
 *
 * Usage:
 *   bun run packages/server/scripts/backfill-extension-followups.ts             # dry run
 *   bun run packages/server/scripts/backfill-extension-followups.ts --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import * as readline from 'node:readline/promises';
import * as schema from '../src/db/schema';
import { ensureCorporateExtensionFollowUp, ensurePersonalExtensionFollowUp } from '../src/lib/extension-followup';

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

const { corporatePipelineTickets, personalPipelineTickets, corporations, personal } = schema;

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === 'yes';
}

async function main() {
  const corporateCandidates = await db
    .select({
      id: corporatePipelineTickets.id,
      company: corporations.company,
      taxYear: corporatePipelineTickets.extensionTaxYear,
      filedDate: corporatePipelineTickets.extensionFiledDate,
    })
    .from(corporatePipelineTickets)
    .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
    .where(
      and(
        eq(corporatePipelineTickets.extensionStatus, 'Filed'),
        isNull(corporatePipelineTickets.extensionFollowUpTicketId)
      )
    );

  const personalCandidates = await db
    .select({
      id: personalPipelineTickets.id,
      firstName: personal.firstName,
      lastName: personal.lastName,
      taxYear: personalPipelineTickets.extensionTaxYear,
      filedDate: personalPipelineTickets.extensionFiledDate,
    })
    .from(personalPipelineTickets)
    .leftJoin(personal, eq(personalPipelineTickets.personalId, personal.id))
    .where(
      and(
        eq(personalPipelineTickets.extensionStatus, 'Filed'),
        isNull(personalPipelineTickets.extensionFollowUpTicketId)
      )
    );

  console.log(`\nFound ${corporateCandidates.length} filed corporate extension(s) missing a follow-up ticket:\n`);
  for (const row of corporateCandidates) {
    console.log(`  ${row.id}  company="${row.company ?? '(none)'}"  taxYear=${row.taxYear ?? '(none)'}  filed=${row.filedDate ?? '(none)'}`);
  }

  console.log(`\nFound ${personalCandidates.length} filed personal extension(s) missing a follow-up ticket:\n`);
  for (const row of personalCandidates) {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '(none)';
    console.log(`  ${row.id}  client="${name}"  taxYear=${row.taxYear ?? '(none)'}  filed=${row.filedDate ?? '(none)'}`);
  }

  const total = corporateCandidates.length + personalCandidates.length;
  if (total === 0) {
    console.log('\nNothing to do.\n');
    await pool.end();
    return;
  }

  if (!isApply) {
    console.log('\n[dry-run] no changes written. Re-run with --apply to create these follow-up tickets.\n');
    await pool.end();
    return;
  }

  const ok = await confirm(`\nType "yes" to create follow-up tickets for these ${total} extension(s): `);
  if (!ok) {
    console.log('Aborted, nothing created.\n');
    await pool.end();
    return;
  }

  let created = 0;
  for (const row of corporateCandidates) {
    try {
      await db.transaction(async (tx) => {
        await ensureCorporateExtensionFollowUp(tx, row.id);
      });
      console.log(`  linked follow-up for corporate ticket ${row.id}`);
      created++;
    } catch (err) {
      console.error(`  FAILED for corporate ticket ${row.id}:`, err);
    }
  }
  for (const row of personalCandidates) {
    try {
      await db.transaction(async (tx) => {
        await ensurePersonalExtensionFollowUp(tx, row.id);
      });
      console.log(`  linked follow-up for personal ticket ${row.id}`);
      created++;
    } catch (err) {
      console.error(`  FAILED for personal ticket ${row.id}:`, err);
    }
  }

  console.log(`\nProcessed ${created}/${total} ticket(s).\n`);
  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
