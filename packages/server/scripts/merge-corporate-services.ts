/**
 * Merges duplicate `services_corporate` catalog rows: repoints everything that
 * references the loser at the keeper, then deletes the loser.
 *
 * The pair list is **hardcoded** in `MERGES` below, like
 * `consolidate-multilocation-corporations.ts`'s `PAIRS` — merging two catalog
 * entries is a human judgement about whether they were ever really different
 * services, not something to re-derive by fuzzy name matching.
 *
 * Currently one pair: "Bookkeeping" -> "Bookkeeping Clients". They always
 * meant the same work; the split is an Airtable-era artifact that leaked into
 * three places —
 *   - the legacy view named "Bookkeeping" actually selects the service
 *     "Bookkeeping Clients" (CORPORATE_VIEW_FILTERS in
 *     src/db/serializers-subscriptions.ts), so `?view=` could never reach the
 *     service literally named "Bookkeeping";
 *   - SERVICES_REQUIRING_PROCESSOR (src/lib/billing-cadence.ts) lists only
 *     "Bookkeeping Clients", so the one bundle on the duplicate generated an
 *     unassigned bookkeeping ticket — exactly what that rule exists to
 *     prevent;
 *   - CorporateClientIntake's hardcoded service list offered "Bookkeeping",
 *     creating new tickets on the duplicate.
 * Merging removes the ambiguity rather than teaching each of those about both
 * names.
 *
 * What gets repointed:
 *   - corporate_pipeline_tickets.service_id   (FK, ON DELETE SET NULL)
 *   - corporate_billing_bundle_items.service_id (FK, ON DELETE RESTRICT — so
 *     the loser genuinely cannot be deleted until these move)
 *   - billing_records.service_type — a stored text label, not an FK. Rewritten
 *     too: those rows store the service name by design so they survive a
 *     rename, but a *merge* means the two labels were always the same service,
 *     and leaving the old string behind orphans those records from the
 *     catalog.
 *
 * Safety:
 * - Default is a dry run — full report, zero writes. Pass --apply to write.
 * - With --apply, requires typing "yes" at a single confirmation prompt.
 * - **Refuses on collision.** `corporate_billing_bundle_items` has a partial
 *   unique index on (bundle_id, service_id) WHERE status = 'active'. If one
 *   bundle holds an active line item for *both* services, repointing would
 *   violate it — and the right resolution (which amount survives?) is a
 *   billing decision. Those bundles are reported and the merge stops before
 *   writing anything. One active + one soft-removed is fine, since the index
 *   only covers active rows.
 * - Also refuses if the loser carries catalog fields (price/description/
 *   category/billing_cycle) the keeper lacks, rather than silently discarding
 *   them with the row.
 * - The whole merge runs in one transaction — a failure leaves nothing
 *   applied and the loser row still present.
 * - Every repointed row id is printed, so the output is a reversal record.
 *
 * Usage:
 *   bun run packages/server/scripts/merge-corporate-services.ts            # dry run
 *   bun run packages/server/scripts/merge-corporate-services.ts --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import * as readline from 'node:readline/promises';

config({ path: resolve(__dirname, '../.env') });

/** loser -> keeper, by exact services_corporate.name. */
const MERGES: { from: string; into: string }[] = [{ from: 'Bookkeeping', into: 'Bookkeeping Clients' }];

const CATALOG_FIELDS = ['price', 'description', 'category', 'billing_cycle'] as const;

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

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(message)).trim().toLowerCase();
  rl.close();
  return answer === 'yes';
}

type Plan = {
  from: string;
  into: string;
  loserId: string;
  keeperId: string;
  tickets: { id: string; company: string | null; status: string | null }[];
  items: { id: string; company: string | null; amount: string; status: string }[];
  billingRows: { id: string; client: string | null; date: string | null; amount: string | null }[];
  blockers: string[];
};

async function plan(merge: { from: string; into: string }): Promise<Plan | null> {
  const { rows: svcRows } = await pool.query(
    `select id, name, price, description, category, billing_cycle
       from services_corporate where name = any($1)`,
    [[merge.from, merge.into]]
  );

  const loser = svcRows.filter((s) => s.name === merge.from);
  const keeper = svcRows.filter((s) => s.name === merge.into);

  if (loser.length === 0) {
    console.log(`\n"${merge.from}" -> "${merge.into}": nothing to do, "${merge.from}" no longer exists.`);
    return null;
  }
  if (keeper.length !== 1 || loser.length !== 1) {
    console.error(
      `\n"${merge.from}" -> "${merge.into}": expected exactly one row each, found ` +
        `${loser.length} and ${keeper.length}. Resolve by hand.`
    );
    process.exit(1);
  }

  const blockers: string[] = [];

  // Catalog fields that would vanish with the loser row.
  for (const f of CATALOG_FIELDS) {
    if (loser[0][f] != null && keeper[0][f] == null) {
      blockers.push(
        `loser carries ${f}="${loser[0][f]}" but the keeper has none — copy it across first, or it is lost with the row`
      );
    }
  }

  // The partial unique index only covers active rows, so one active + one
  // removed on the same bundle is fine; two active is not.
  const { rows: collisions } = await pool.query(
    `select c.company
       from corporate_billing_bundle_items a
       join corporate_billing_bundle_items b
         on b.bundle_id = a.bundle_id and b.service_id = $2 and b.status = 'active'
       join corporate_billing_bundles bu on bu.id = a.bundle_id
       join corporations c on c.id = bu.corporation_id
      where a.service_id = $1 and a.status = 'active'`,
    [loser[0].id, keeper[0].id]
  );
  for (const c of collisions) {
    blockers.push(
      `${c.company?.trim()} has an ACTIVE line item for both services — merging would break the ` +
        `one-active-item-per-service index. Decide which amount survives, remove the other, then re-run`
    );
  }

  const { rows: tickets } = await pool.query(
    `select t.id, c.company, t.status
       from corporate_pipeline_tickets t
       left join corporations c on c.id = t.corporation_id
      where t.service_id = $1 order by c.company nulls last`,
    [loser[0].id]
  );
  const { rows: items } = await pool.query(
    `select i.id, c.company, i.amount, i.status
       from corporate_billing_bundle_items i
       join corporate_billing_bundles b on b.id = i.bundle_id
       join corporations c on c.id = b.corporation_id
      where i.service_id = $1 order by c.company`,
    [loser[0].id]
  );
  const { rows: billingRows } = await pool.query(
    `select id, client_name as client, service_rendered_date::text as date, amount_charged as amount
       from billing_records where service_type = $1 order by service_rendered_date nulls last`,
    [merge.from]
  );

  return {
    ...merge,
    loserId: loser[0].id,
    keeperId: keeper[0].id,
    tickets,
    items,
    billingRows,
    blockers,
  };
}

function report(p: Plan) {
  console.log(`\n=== "${p.from}" (${p.loserId})  ->  "${p.into}" (${p.keeperId}) ===\n`);

  console.log(`  pipeline tickets to repoint: ${p.tickets.length}`);
  for (const t of p.tickets)
    console.log(`    ${t.id}  company="${t.company?.trim() ?? '(none)'}"  status=${t.status ?? '(null)'}`);

  console.log(`\n  bundle line items to repoint: ${p.items.length}`);
  for (const i of p.items)
    console.log(`    ${i.id}  company="${i.company?.trim()}"  $${Number(i.amount).toFixed(2)}  ${i.status}`);

  console.log(`\n  billing_records to relabel: ${p.billingRows.length}`);
  for (const b of p.billingRows)
    console.log(
      `    ${b.id}  client="${b.client ?? '(none)'}"  date=${b.date ?? '(none)'}  $${Number(b.amount ?? 0).toFixed(2)}`
    );

  if (p.blockers.length) {
    console.log(`\n  BLOCKED — nothing will be written:`);
    for (const b of p.blockers) console.log(`    - ${b}`);
  }
}

async function main() {
  console.log(`\nCorporate service merge — ${isApply ? 'APPLY' : 'dry run'}`);

  const plans: Plan[] = [];
  for (const m of MERGES) {
    const p = await plan(m);
    if (p) {
      report(p);
      plans.push(p);
    }
  }

  const runnable = plans.filter((p) => p.blockers.length === 0);
  const blocked = plans.filter((p) => p.blockers.length > 0);

  if (runnable.length === 0) {
    console.log(
      blocked.length ? '\nNothing can be merged — resolve the blockers above first.\n' : '\nNothing to merge.\n'
    );
    await pool.end();
    return;
  }

  const totalRows = runnable.reduce(
    (n, p) => n + p.tickets.length + p.items.length + p.billingRows.length,
    0
  );

  if (!isApply) {
    console.log(
      `\n[dry-run] no changes written. Re-run with --apply to repoint ${totalRows} row(s) and ` +
        `delete ${runnable.length} catalog row(s).\n`
    );
    await pool.end();
    return;
  }

  const ok = await confirm(
    `\nType "yes" to repoint ${totalRows} row(s) and permanently delete ${runnable.length} service row(s): `
  );
  if (!ok) {
    console.log('Aborted, nothing written.\n');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of runnable) {
      const t = await client.query(
        `update corporate_pipeline_tickets set service_id = $2 where service_id = $1`,
        [p.loserId, p.keeperId]
      );
      const i = await client.query(
        `update corporate_billing_bundle_items set service_id = $2 where service_id = $1`,
        [p.loserId, p.keeperId]
      );
      const b = await client.query(
        `update billing_records set service_type = $2 where service_type = $1`,
        [p.from, p.into]
      );
      const d = await client.query(`delete from services_corporate where id = $1`, [p.loserId]);

      console.log(
        `\n  "${p.from}" -> "${p.into}": ${t.rowCount} ticket(s), ${i.rowCount} line item(s), ` +
          `${b.rowCount} billing record(s) repointed; ${d.rowCount} catalog row deleted.`
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('\nDone.');
  if (blocked.length) console.log(`${blocked.length} merge(s) left untouched pending review (see BLOCKED above).`);
  console.log();
  await pool.end();
}

main().catch((err) => {
  console.error('Merge failed:', err);
  process.exit(1);
});
