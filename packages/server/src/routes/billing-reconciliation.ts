/**
 * GET /api/billing-reconciliation
 *
 * Read-only audit that cross-checks pipeline tickets against billing_records
 * to surface revenue leaks. Completing a ticket writes the billing record and
 * the status change as two separate client-side requests (see
 * handleCompleteService in CorporateServicesPipeline.tsx / handleFileReturn in
 * PersonalServicesPipeline.tsx), so work can end up marked done with no charge
 * recorded and nothing else in the app would ever notice.
 *
 * Checks, in the order they cost money:
 *   1. completed-not-billed  — ticket says done, no billing record exists
 *   2. missing-amount        — billing record exists but nobody set a price
 *   3. unbilled-aging        — work recorded, never invoiced
 *   4. unpaid-aging          — invoiced, never collected
 *   5. bundle-mismatch       — charged to a bundle the ticket isn't part of
 *
 * Deliberate exclusions:
 *   - Personal 'Filed Elsewhere' is NOT a leak — it records that the client
 *     filed with someone else, so there is no work of ours to bill.
 *   - 'Part of Subscription' is the legacy name for 'Covered by Bundle'
 *     (see WIRE_BILLING_STATUSES in db/serializers-subscriptions.ts). Both are
 *     treated as legitimately zero-amount everywhere below.
 *   - Historical billing_records with no ticket link at all are ignored:
 *     tickets used to be deleted at billing time, so the link is absent by
 *     design on pre-migration rows and its absence proves nothing.
 */

import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';

const app = new Hono();

// Statuses meaning "we did this work" — the legacy 'Completed' variant is
// still present on real corporate rows alongside the current 'Complete
// Service', and the pipeline UI treats both as terminal.
const CORPORATE_DONE_STATUSES = ['Complete Service', 'Completed'];
const PERSONAL_DONE_STATUSES = ['File Return'];

// Billing statuses where a zero/absent amount is correct, not an omission.
const ZERO_AMOUNT_OK_STATUSES = ['Waived', 'Covered by Bundle', 'Part of Subscription'];

const BUNDLE_STATUSES = ['Covered by Bundle', 'Part of Subscription'];

const DETAIL_LIMIT = 100;

type Severity = 'critical' | 'warning' | 'info';

interface CheckRow {
  id: string;
  client: string | null;
  service: string | null;
  date: string | null;
  amount: number | null;
  status: string | null;
  processor: string | null;
  clientType: 'corporate' | 'personal' | null;
  ageDays: number | null;
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

interface Check {
  key: string;
  title: string;
  description: string;
  severity: Severity;
  count: number;
  amount: number | null;
  rows: CheckRow[];
  truncated: boolean;
  buckets?: AgingBucket[];
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

// Legacy text date columns hold a mix of 'YYYY-MM-DD' and full ISO
// timestamps (Airtable-era values kept verbatim), so trim to the date part.
const toDateOnly = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, 10) : null);

// Renders a string[] as a parameterized `$1, $2, ...` list for use inside an
// `in (...)`. Drizzle expands a bare JS array in a sql`` template into that
// same parameter list, which makes `= any(${arr})` compile to the invalid
// `= any(($1, $2))` — a row constructor, not an array — so `in` is the form
// that actually works here.
const inList = (values: readonly string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);

/**
 * Aging buckets by service_rendered_date. Rows with no date land in the
 * oldest bucket rather than vanishing — an undated charge is at least as
 * stale as the ones we can measure.
 */
const AGING_CASE = sql`case
  when service_rendered_date is null then '90d+ / undated'
  when service_rendered_date >= current_date - 30 then '0-30 days'
  when service_rendered_date >= current_date - 60 then '31-60 days'
  when service_rendered_date >= current_date - 90 then '61-90 days'
  else '90d+ / undated' end`;

const BUCKET_ORDER = ['0-30 days', '31-60 days', '61-90 days', '90d+ / undated'];

function sortBuckets(rows: AgingBucket[]): AgingBucket[] {
  return [...rows].sort((a, b) => BUCKET_ORDER.indexOf(a.label) - BUCKET_ORDER.indexOf(b.label));
}

app.get('/', async (c) => {
  try {
    const db = getDb();
    const checks: Check[] = [];

    // ---- 1. Work marked done with no billing record at all ----------------
    const notBilled = await db.execute(sql`
      select t.id,
             coalesce(corp.company, '(unnamed)') as client,
             sv.name as service,
             t.status,
             t.due_date::text as date,
             'corporate' as client_type,
             (current_date - t.created_at::date) as age_days
        from corporate_pipeline_tickets t
        left join corporations corp on corp.id = t.corporation_id
        left join services_corporate sv on sv.id = t.service_id
       where t.status in (${inList(CORPORATE_DONE_STATUSES)})
         and not exists (
           select 1 from billing_records b where b.subscription_corporate_id = t.id
         )
      union all
      select t.id,
             coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), '(unnamed)') as client,
             sv.name as service,
             t.status,
             null as date,
             'personal' as client_type,
             (current_date - t.created_at::date) as age_days
        from personal_pipeline_tickets t
        left join personal p on p.id = t.personal_id
        left join personal_services sv on sv.id = t.service_id
       where t.status in (${inList(PERSONAL_DONE_STATUSES)})
         and not exists (
           select 1 from billing_records b where b.subscription_personal_id = t.id
         )
       order by age_days desc
    `);

    checks.push({
      key: 'completed-not-billed',
      title: 'Completed work with no billing record',
      description:
        'The ticket says the work is done, but no billing record was ever created for it. This is unrecoverable revenue until someone bills it manually.',
      severity: 'critical',
      count: notBilled.rows.length,
      amount: null,
      rows: notBilled.rows.slice(0, DETAIL_LIMIT).map((r: any) => ({
        id: r.id,
        client: r.client,
        service: r.service,
        date: toDateOnly(r.date),
        amount: null,
        status: r.status,
        processor: null,
        clientType: r.client_type,
        ageDays: r.age_days == null ? null : Number(r.age_days),
      })),
      truncated: notBilled.rows.length > DETAIL_LIMIT,
    });

    // ---- 2. Billing record exists but no amount was ever set --------------
    const missingAmount = await db.execute(sql`
      select id, client_name, service_type, service_rendered_date::text as date,
             amount_charged, billing_status, processor, client_type,
             (current_date - coalesce(service_rendered_date, created_at::date)) as age_days
        from billing_records
       where (amount_charged is null or amount_charged = 0)
         and (billing_status is null or billing_status not in (${inList(ZERO_AMOUNT_OK_STATUSES)}))
       order by age_days desc nulls last
    `);

    checks.push({
      key: 'missing-amount',
      title: 'Billing records with no amount',
      description:
        'A charge was recorded but left at $0 or blank, and it is not marked Waived or bundle-covered. These cannot be invoiced until someone sets a price.',
      severity: 'critical',
      count: missingAmount.rows.length,
      amount: null,
      rows: missingAmount.rows.slice(0, DETAIL_LIMIT).map((r: any) => ({
        id: r.id,
        client: r.client_name,
        service: r.service_type,
        date: toDateOnly(r.date),
        amount: r.amount_charged == null ? null : num(r.amount_charged),
        status: r.billing_status,
        processor: r.processor,
        clientType: r.client_type,
        ageDays: r.age_days == null ? null : Number(r.age_days),
      })),
      truncated: missingAmount.rows.length > DETAIL_LIMIT,
    });

    // ---- 3 & 4. Aging on unbilled and unpaid ------------------------------
    for (const [key, status, title, description, severity] of [
      [
        'unbilled-aging',
        'Unbilled',
        'Work recorded but never invoiced',
        'Billing records still sitting at Unbilled. The dollar total is money earned that has not been asked for yet.',
        'warning',
      ],
      [
        'unpaid-aging',
        'Billed - Unpaid',
        'Invoiced but never collected',
        'Billing records invoiced to the client with no payment recorded — accounts receivable, aged by service date.',
        'warning',
      ],
    ] as const) {
      const buckets = await db.execute(sql`
        select ${AGING_CASE} as label, count(*)::int as count,
               coalesce(sum(coalesce(amount_charged, 0)), 0) as amount
          from billing_records
         where billing_status = ${status}
         group by 1
      `);

      const detail = await db.execute(sql`
        select id, client_name, service_type, service_rendered_date::text as date,
               amount_charged, billing_status, processor, client_type,
               (current_date - coalesce(service_rendered_date, created_at::date)) as age_days
          from billing_records
         where billing_status = ${status}
         order by age_days desc nulls last
      `);

      const bucketRows: AgingBucket[] = buckets.rows.map((r: any) => ({
        label: r.label,
        count: Number(r.count),
        amount: num(r.amount),
      }));

      checks.push({
        key,
        title,
        description,
        severity,
        count: detail.rows.length,
        amount: bucketRows.reduce((sum, b) => sum + b.amount, 0),
        rows: detail.rows.slice(0, DETAIL_LIMIT).map((r: any) => ({
          id: r.id,
          client: r.client_name,
          service: r.service_type,
          date: toDateOnly(r.date),
          amount: r.amount_charged == null ? null : num(r.amount_charged),
          status: r.billing_status,
          processor: r.processor,
          clientType: r.client_type,
          ageDays: r.age_days == null ? null : Number(r.age_days),
        })),
        truncated: detail.rows.length > DETAIL_LIMIT,
        buckets: sortBuckets(bucketRows),
      });
    }

    // ---- 5. Bundle-covered charge on a ticket with no bundle line ---------
    const bundleMismatch = await db.execute(sql`
      select b.id, b.client_name, b.service_type, b.service_rendered_date::text as date,
             b.amount_charged, b.billing_status, b.processor, b.client_type,
             (current_date - coalesce(b.service_rendered_date, b.created_at::date)) as age_days
        from billing_records b
        join corporate_pipeline_tickets t on t.id = b.subscription_corporate_id
       where b.billing_status in (${inList(BUNDLE_STATUSES)})
         and t.bundle_item_id is null
       order by age_days desc nulls last
    `);

    checks.push({
      key: 'bundle-mismatch',
      title: 'Bundle-covered charge on a non-bundle ticket',
      description:
        'The charge was written off as covered by the client\'s recurring bundle, but the ticket is not linked to any bundle line item — so the work was given away for free.',
      severity: 'warning',
      count: bundleMismatch.rows.length,
      amount: null,
      rows: bundleMismatch.rows.slice(0, DETAIL_LIMIT).map((r: any) => ({
        id: r.id,
        client: r.client_name,
        service: r.service_type,
        date: toDateOnly(r.date),
        amount: r.amount_charged == null ? null : num(r.amount_charged),
        status: r.billing_status,
        processor: r.processor,
        clientType: r.client_type,
        ageDays: r.age_days == null ? null : Number(r.age_days),
      })),
      truncated: bundleMismatch.rows.length > DETAIL_LIMIT,
    });

    const atRisk = checks.reduce((sum, ch) => sum + (ch.amount ?? 0), 0);

    return c.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        detailLimit: DETAIL_LIMIT,
        totalAtRisk: atRisk,
        totalFindings: checks.reduce((sum, ch) => sum + ch.count, 0),
        checks,
      },
    });
  } catch (error) {
    console.error('GET /api/billing-reconciliation error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run billing reconciliation',
      },
      500
    );
  }
});

export default app;
