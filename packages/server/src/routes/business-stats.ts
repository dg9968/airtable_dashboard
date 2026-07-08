/**
 * Business Stats API Routes (Postgres-backed)
 * Provides aggregated statistics for the dashboard
 */

import { Hono } from 'hono';
import { count, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporations, personal, subscriptionsCorporate, ledger } from '../db/schema';
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
      monthLedger,
    ] = await Promise.all([
      db.select({ corporateClients: count() }).from(corporations),
      db.select({ personalClients: count() }).from(personal),
      db.select({ activeProcessors: count() }).from(authUser),
      db.select({ monthlyRevenue: sql<string>`coalesce(sum(${subscriptionsCorporate.billingAmount}), 0)` }).from(subscriptionsCorporate),
      db.select({ receiptDate: ledger.receiptDate, amountCharged: ledger.amountCharged }).from(ledger),
    ]);

    // Tasks completed this month = ledger entries with Receipt Date in the
    // current month. receipt_date holds mixed date / ISO strings, so parse in JS.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let tasksCompletedThisMonth = 0;
    let monthlyTaskRevenue = 0;
    for (const entry of monthLedger) {
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
