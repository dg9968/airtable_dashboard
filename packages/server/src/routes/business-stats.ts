/**
 * Business Stats API Routes (Postgres-backed)
 * Provides aggregated statistics for the dashboard
 */

import { Hono } from 'hono';
import { and, count, eq, sql } from 'drizzle-orm';
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

    const [
      [{ corporateClients }],
      [{ personalClients }],
      [{ activeProcessors }],
      [{ monthlyRevenue }],
      paidRecords,
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
        .select({ receiptDate: billingRecords.receiptDate, amountCharged: billingRecords.amountCharged })
        .from(billingRecords)
        .where(eq(billingRecords.billingStatus, 'Billed - Paid')),
    ]);

    // Tasks completed this month = paid billing records with Receipt Date in
    // the current month. receipt_date holds mixed date / ISO strings, so
    // month-bucketing still happens in JS, but the paid-only filter is now a
    // SQL predicate instead of scanning every historical record.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let tasksCompletedThisMonth = 0;
    let monthlyTaskRevenue = 0;
    for (const entry of paidRecords) {
      if (!entry.receiptDate) continue;
      const date = new Date(entry.receiptDate);
      if (date >= startOfMonth && date <= endOfMonth) {
        tasksCompletedThisMonth++;
        monthlyTaskRevenue += entry.amountCharged != null ? Number(entry.amountCharged) : 0;
      }
    }

    return c.json({
      success: true,
      data: {
        totalClients: corporateClients + personalClients,
        corporateClients,
        personalClients,
        monthlyRevenue: Number(monthlyRevenue),
        monthlyRevenueRecorded: monthlyTaskRevenue,
        activeProcessors,
        tasksCompletedThisMonth,
        monthlyTaskRevenue,
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
