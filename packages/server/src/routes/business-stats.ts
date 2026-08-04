/**
 * Business Stats API Routes (Postgres-backed)
 * Provides aggregated statistics for the dashboard
 */

import { Hono } from 'hono';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  corporations,
  personal,
  corporateBillingBundles,
  corporateBillingBundleItems,
  corporatePipelineTickets,
  servicesCorporate,
  billingRecords,
} from '../db/schema';

const app = new Hono();

// Same terminal statuses as workload-dashboard.ts / open-tickets-dashboard.ts,
// including the legacy corporate 'Completed' spelling still on real rows.
// Anything else (including null) is open.
const CORPORATE_TERMINAL_STATUSES = ['Complete Service', 'Completed'];
const PERSONAL_TERMINAL_STATUSES = ['File Return', 'Filed Elsewhere'];

const inList = (values: readonly string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);

/**
 * GET /api/business-stats
 * Get aggregated business statistics
 */
app.get('/', async (c) => {
  try {
    const db = getDb();

    // Now that receipt_date is a real `date` column (verified 100% clean
    // 'YYYY-MM-DD' data — see migration 0010), this month-revenue figure is
    // a single filtered SQL aggregate instead of pulling every paid record
    // over the wire and bucketing in JS.
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonth = `${endOfMonthDate.getFullYear()}-${String(endOfMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endOfMonthDate.getDate()).padStart(2, '0')}`;

    const [
      [{ corporateClients }],
      [{ personalClients }],
      processorRows,
      [{ recurringMonthlyRevenue }],
      [{ paymentsThisMonth, revenueCollectedThisMonth }],
      [{ activeBookkeepingClients }],
    ] = await Promise.all([
      db.select({ corporateClients: count() }).from(corporations),
      db.select({ personalClients: count() }).from(personal),
      // Staff who actually have work in front of them right now — distinct
      // assignees holding at least one open ticket on either pipeline. This
      // used to be count(user), which counted every account that had ever
      // been created (admins, ex-staff, logins that never touch a ticket)
      // under the label "staff members handling work".
      db.execute<{ active_processors: number }>(sql`
        select count(distinct user_id)::int as active_processors
          from (
            select processor_id as user_id
              from corporate_pipeline_tickets
             where processor_id is not null
               and (status is null or status not in (${inList(CORPORATE_TERMINAL_STATUSES)}))
            union
            select tax_preparer_id as user_id
              from personal_pipeline_tickets
             where tax_preparer_id is not null
               and (status is null or status not in (${inList(PERSONAL_TERMINAL_STATUSES)}))
          ) q
      `),
      // Recurring monthly revenue = sum of active line items on active
      // bundles. Unlike the old per-ticket billing_amount, this never
      // shrinks when a covered piece of work is completed and billed,
      // since bundles are never deleted. Contracted, not yet collected —
      // deliberately a different number from revenueCollectedThisMonth.
      db
        .select({ recurringMonthlyRevenue: sql<string>`coalesce(sum(${corporateBillingBundleItems.amount}), 0)` })
        .from(corporateBillingBundleItems)
        .innerJoin(corporateBillingBundles, eq(corporateBillingBundleItems.bundleId, corporateBillingBundles.id))
        .where(and(eq(corporateBillingBundleItems.status, 'active'), eq(corporateBillingBundles.status, 'active'))),
      // Money actually received this month. The count is payments received,
      // not work finished — a billing_record reaches 'Billed - Paid' when the
      // receipt lands, and bundle-covered work never passes through here at
      // all (it sits at 'Covered by Bundle'). Labelling it "tasks completed"
      // overstated throughput and hid all bundled work.
      db
        .select({
          paymentsThisMonth: count(),
          revenueCollectedThisMonth: sql<string>`coalesce(sum(${billingRecords.amountCharged}), 0)`,
        })
        .from(billingRecords)
        .where(
          and(
            eq(billingRecords.billingStatus, 'Billed - Paid'),
            gte(billingRecords.receiptDate, startOfMonth),
            lte(billingRecords.receiptDate, endOfMonth)
          )
        ),
      // Mirrors the exact query /api/processor-billing runs, so the figure on
      // the Processor Billing tile is the row count that page will render.
      db
        .select({ activeBookkeepingClients: count() })
        .from(corporatePipelineTickets)
        .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
        .where(
          and(
            eq(servicesCorporate.name, 'Bookkeeping Clients'),
            eq(corporatePipelineTickets.status, 'Active')
          )
        ),
    ]);

    return c.json({
      success: true,
      data: {
        totalClients: corporateClients + personalClients,
        corporateClients,
        personalClients,
        recurringMonthlyRevenue: Number(recurringMonthlyRevenue),
        revenueCollectedThisMonth: Number(revenueCollectedThisMonth),
        paymentsThisMonth: Number(paymentsThisMonth),
        activeProcessors: processorRows.rows[0]?.active_processors ?? 0,
        activeBookkeepingClients,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching business stats:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch business stats'
      },
      500
    );
  }
});

export default app;
