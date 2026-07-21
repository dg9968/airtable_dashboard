/**
 * Ledger API Routes (Postgres-backed)
 *
 * Read-only compat view over billing_records ("Services Rendered"): the
 * ledger is simply every billing record that's actually been paid. There's
 * no separate Ledger table anymore — a ledger entry and the billing record
 * that produced it were always the same fact, so they're the same row now
 * (see db/schema/subscriptions.ts). Response shape is unchanged so
 * app/ledger's page needs no client-side changes.
 */

import { Hono } from 'hono';
import { and, desc, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { billingRecords } from '../db/schema';
import { billingRecordToAirtableRecord } from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * GET /api/ledger
 * Fetch paid billing records ("ledger entries") with filtering and grouping
 */
app.get('/', async (c) => {
  try {
    const db = getDb();

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const clientName = c.req.query('clientName');
    const paymentMethod = c.req.query('paymentMethod');
    const groupBy = c.req.query('groupBy') || 'client';

    const conditions = [eq(billingRecords.billingStatus, 'Billed - Paid')];
    if (startDate) conditions.push(gt(billingRecords.receiptDate, startDate));
    if (endDate) conditions.push(lt(billingRecords.receiptDate, endDate));
    if (paymentMethod) conditions.push(eq(billingRecords.paymentMethod, paymentMethod));

    const rows = await db
      .select()
      .from(billingRecords)
      .where(and(...conditions))
      .orderBy(desc(billingRecords.receiptDate));

    console.log(`Fetched ${rows.length} ledger (paid billing) records`);

    let processedEntries = rows.map((row) => {
      const record = billingRecordToAirtableRecord(row);
      return {
        id: row.id,
        fields: record.fields,
        clientName: row.clientName || 'Unknown Client',
        serviceRendered: row.serviceType || 'Service',
        receiptDate: row.receiptDate || '',
        amountCharged: row.amountCharged != null ? Number(row.amountCharged) : 0,
        paymentMethod: row.paymentMethod || 'Unknown',
        processor: row.processor || '',
        createdTime: row.createdAt.toISOString(),
      };
    });

    if (clientName) {
      const lowerClientName = clientName.toLowerCase();
      processedEntries = processedEntries.filter((e) => e.clientName.toLowerCase().includes(lowerClientName));
    }

    const summary = {
      totalRevenue: processedEntries.reduce((sum, e) => sum + (e.amountCharged || 0), 0),
      totalEntries: processedEntries.length,
      uniqueClients: new Set(processedEntries.map((e) => e.clientName)).size,
    };

    const grouped = groupRecords(processedEntries, groupBy as 'client' | 'date' | 'payment');

    return c.json({
      success: true,
      data: {
        entries: processedEntries,
        summary,
        groupedBy: groupBy,
        grouped,
      },
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch ledger' },
      500
    );
  }
});

/**
 * Helper function to group records
 */
function groupRecords(records: any[], groupBy: 'client' | 'date' | 'payment') {
  const grouped: any = {};

  records.forEach(record => {
    let key = '';

    switch (groupBy) {
      case 'client':
        key = record.clientName;
        break;
      case 'date':
        // Group by month
        const date = new Date(record.receiptDate);
        key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        break;
      case 'payment':
        key = record.paymentMethod;
        break;
    }

    if (!grouped[key]) {
      grouped[key] = {
        groupName: key,
        entries: [],
        totalAmount: 0,
        count: 0,
      };
    }

    grouped[key].entries.push(record);
    grouped[key].totalAmount += record.amountCharged || 0;
    grouped[key].count++;
  });

  const groupedArray = Object.values(grouped) as any[];

  if (groupBy === 'date') {
    groupedArray.sort((a: any, b: any) => {
      const dateA = new Date(a.groupName);
      const dateB = new Date(b.groupName);
      return dateB.getTime() - dateA.getTime();
    });
  } else {
    groupedArray.sort((a: any, b: any) => b.totalAmount - a.totalAmount);
  }

  groupedArray.forEach((group: any) => {
    group.entries.sort((a: any, b: any) => {
      const dateA = new Date(a.receiptDate);
      const dateB = new Date(b.receiptDate);
      return dateB.getTime() - dateA.getTime();
    });
  });

  return groupedArray;
}

export default app;
