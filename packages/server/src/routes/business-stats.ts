/**
 * Business Stats API Routes (Postgres-backed)
 * Provides aggregated statistics for the dashboard
 */

import { Hono } from 'hono';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporations, personal, corporateBillingBundles, corporateBillingBundleItems, billingRecords } from '../db/schema';
import { authUser } from '../db/auth-readonly';

const app = new Hono();

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
      [{ activeProcessors }],
      [{ monthlyRevenue }],
      [{ tasksCompletedThisMonth, monthlyTaskRevenue }],
    ] = await Promise.all([
      db.select({ corporateClients: count() }).from(corporations),
      db.select({ personalClients: count() }).from(personal),
      db.select({ activeProcessors: count() }).from(authUser),
      // Recurring monthly revenue = sum of active line items on active
      // bundles. Unlike the old per-ticket billing_amount, this never
      // shrinks when a covered piece of work is completed and billed,
      // since bundles are never deleted.
      db
        .select({ monthlyRevenue: sql<string>`coalesce(sum(${corporateBillingBundleItems.amount}), 0)` })
        .from(corporateBillingBundleItems)
        .innerJoin(corporateBillingBundles, eq(corporateBillingBundleItems.bundleId, corporateBillingBundles.id))
        .where(and(eq(corporateBillingBundleItems.status, 'active'), eq(corporateBillingBundles.status, 'active'))),
      db
        .select({
          tasksCompletedThisMonth: count(),
          monthlyTaskRevenue: sql<string>`coalesce(sum(${billingRecords.amountCharged}), 0)`,
        })
        .from(billingRecords)
        .where(
          and(
            eq(billingRecords.billingStatus, 'Billed - Paid'),
            gte(billingRecords.receiptDate, startOfMonth),
            lte(billingRecords.receiptDate, endOfMonth)
          )
        ),
    ]);

    return c.json({
      success: true,
      data: {
        totalClients: corporateClients + personalClients,
        corporateClients,
        personalClients,
        monthlyRevenue: Number(monthlyRevenue),
        monthlyRevenueRecorded: Number(monthlyTaskRevenue),
        activeProcessors,
        tasksCompletedThisMonth: Number(tasksCompletedThisMonth),
        monthlyTaskRevenue: Number(monthlyTaskRevenue),
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
