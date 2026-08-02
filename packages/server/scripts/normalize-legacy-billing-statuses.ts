/**
 * Rewrites legacy `billing_records.billing_status` values to their current
 * equivalent, per LEGACY_STATUS_MAP below.
 *
 * Why this matters beyond tidiness: BillingStatusBadge.tsx renders an
 * unrecognized status with `statusConfig[status] || statusConfig['Unbilled']`,
 * so every 'Part of Subscription' row currently displays to staff as
 * "Unbilled" with a warning badge — bundle-covered work that looks like it
 * still needs invoicing. The status is also missing from the billing page's
 * status dropdown, so those rows can't be filtered to at all.
 *
 * Behaviour is otherwise unchanged by this rename:
 *   - Revenue counts only 'Billed - Paid' (business-stats.ts), untouched here.
 *   - The billing page's "Need Review" worklist shows only 'Unbilled' and
 *     'Billed - Unpaid', so both the old and new value stay excluded.
 *   - billing-reconciliation.ts already treats the pair as equivalent.
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - With --apply, requires typing "yes" at a single confirmation prompt.
 * - Rows carrying a non-zero amount are reported as NEEDS REVIEW and are
 *   never rewritten by default: a bundle-covered charge should be $0, so a
 *   non-zero one may have been mislabelled and deserves a human look. Pass
 *   --clear-amounts to rewrite those too, zeroing the amount — only correct
 *   once someone has confirmed the amount was entered by mistake rather than
 *   the status being wrong.
 * - Writes run inside one transaction, so a failure leaves nothing applied.
 * - Prints every affected row id, so the run output is a reversal record.
 *
 * Usage:
 *   bun run packages/server/scripts/normalize-legacy-billing-statuses.ts                          # dry run
 *   bun run packages/server/scripts/normalize-legacy-billing-statuses.ts --apply
 *   bun run packages/server/scripts/normalize-legacy-billing-statuses.ts --clear-amounts --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import * as readline from 'node:readline/promises';

config({ path: resolve(__dirname, '../.env') });

// legacy value -> current value. See WIRE_BILLING_STATUSES in
// packages/server/src/db/serializers-subscriptions.ts for the accepted set.
const LEGACY_STATUS_MAP: Record<string, string> = {
  'Part of Subscription': 'Covered by Bundle',
};

const isApply = process.argv.includes('--apply');
// Treats a non-zero amount on a legacy-status row as a data-entry mistake and
// zeroes it as part of the rewrite, instead of leaving the row for review.
const clearAmounts = process.argv.includes('--clear-amounts');

// The zero convention for bundle-covered rows: 89 of the 96 existing
// 'Covered by Bundle' rows store 0 rather than NULL.
const ZERO_AMOUNT = '0';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (packages/server/.env)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('.render.com') ? { rejectUnauthorized: false } : false,
});

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === 'yes';
}

async function main() {
  let totalEligible = 0;
  let totalFlagged = 0;

  for (const [legacy, current] of Object.entries(LEGACY_STATUS_MAP)) {
    const { rows } = await pool.query(
      `select id, client_name, client_type, service_type,
              service_rendered_date::text as service_date,
              coalesce(amount_charged, 0) as amount
         from billing_records
        where billing_status = $1
        order by service_rendered_date nulls first`,
      [legacy]
    );

    const flagged = rows.filter((r) => Number(r.amount) !== 0);
    const eligible = rows.filter((r) => Number(r.amount) === 0);

    const rewriteCount = clearAmounts ? rows.length : eligible.length;
    console.log(`\n"${legacy}" -> "${current}"`);
    console.log(
      `  ${rows.length} row(s) found: ${rewriteCount} to rewrite, ${clearAmounts ? 0 : flagged.length} needing review\n`
    );

    for (const r of eligible) {
      console.log(
        `  ${r.id}  ${r.client_type ?? '?'}  client="${r.client_name ?? '(none)'}"  service="${r.service_type ?? '(none)'}"  date=${r.service_date ?? '(none)'}`
      );
    }

    if (flagged.length > 0) {
      console.log(
        clearAmounts
          ? `\n  --clear-amounts — non-zero amount treated as a mistake, will be zeroed:\n`
          : `\n  NEEDS REVIEW — non-zero amount, left untouched:\n`
      );
      for (const r of flagged) {
        console.log(
          `  ${r.id}  client="${r.client_name ?? '(none)'}"  service="${r.service_type ?? '(none)'}"  amount=$${Number(r.amount).toFixed(2)}${clearAmounts ? ' -> $0.00' : ''}`
        );
      }
    }

    totalEligible += rewriteCount;
    if (!clearAmounts) totalFlagged += flagged.length;
  }

  if (totalEligible === 0) {
    console.log('\nNothing to rewrite.\n');
    await pool.end();
    return;
  }

  if (!isApply) {
    console.log(`\n[dry-run] no changes written. Re-run with --apply to rewrite ${totalEligible} row(s).\n`);
    await pool.end();
    return;
  }

  const ok = await confirm(`\nType "yes" to rewrite ${totalEligible} row(s): `);
  if (!ok) {
    console.log('Aborted, nothing written.\n');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const [legacy, current] of Object.entries(LEGACY_STATUS_MAP)) {
      const res = await client.query(
        `update billing_records
            set billing_status = $2
          where billing_status = $1
            and coalesce(amount_charged, 0) = 0`,
        [legacy, current]
      );
      updated += res.rowCount ?? 0;

      if (clearAmounts) {
        const cleared = await client.query(
          `update billing_records
              set billing_status = $2, amount_charged = $3
            where billing_status = $1
              and coalesce(amount_charged, 0) <> 0`,
          [legacy, current, ZERO_AMOUNT]
        );
        updated += cleared.rowCount ?? 0;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`\nRewrote ${updated} row(s).`);
  if (totalFlagged > 0) {
    console.log(`${totalFlagged} row(s) left untouched pending review (see NEEDS REVIEW above).`);
  }
  console.log();
  await pool.end();
}

main().catch((err) => {
  console.error('Normalization failed:', err);
  process.exit(1);
});
