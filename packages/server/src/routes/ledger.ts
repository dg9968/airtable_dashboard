/**
 * Ledger API Routes (Postgres-backed)
 *
 * Manages ledger entries for tracking service revenue
 */

import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ledger, servicesRendered, subscriptionsPersonal, subscriptionsCorporate } from '../db/schema';
import { ledgerToAirtableRecord } from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * POST /api/ledger
 * Create a new ledger entry
 */
app.post('/', async (c) => {
  try {
    const { subscriptionId, subscriptionType, clientName, serviceType, amountCharged, receiptDate, paymentMethod } = await c.req.json();

    if (!subscriptionId || !clientName || !amountCharged || !receiptDate || !paymentMethod) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, clientName, amountCharged, receiptDate, paymentMethod',
        },
        400
      );
    }

    const type = subscriptionType || 'personal';
    const service = serviceType || 'Personal Tax Return';

    console.log('Creating Ledger entry:', { subscriptionId, subscriptionType: type, clientName, serviceType: service, amountCharged, receiptDate, paymentMethod });

    const db = getDb();

    // Verify the subscription exists
    const table = type === 'corporate' ? subscriptionsCorporate : subscriptionsPersonal;
    const [subscription] = await db
      .select({ id: table.id })
      .from(table as any)
      .where(eq(table.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return c.json(
        {
          success: false,
          error: `Subscription not found in ${type === 'corporate' ? 'Subscriptions Corporate' : 'Subscriptions Personal'}`,
        },
        404
      );
    }

    const [row] = await db
      .insert(ledger)
      .values({
        serviceRendered: service,
        receiptDate,
        amountCharged: String(amountCharged),
        nameOfClient: clientName,
        paymentMethod,
        subscriptionPersonalId: type === 'personal' ? subscriptionId : null,
        subscriptionCorporateId: type === 'corporate' ? subscriptionId : null,
      })
      .returning();

    const record = ledgerToAirtableRecord(row);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error creating Ledger entry:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create ledger entry',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/ledger
 * Fetch ledger entries with filtering and grouping
 */
app.get('/', async (c) => {
  try {
    const db = getDb();

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const clientName = c.req.query('clientName');
    const paymentMethod = c.req.query('paymentMethod');
    const groupBy = c.req.query('groupBy') || 'client';

    const conditions = [];
    if (startDate) conditions.push(gt(ledger.receiptDate, startDate));
    if (endDate) conditions.push(lt(ledger.receiptDate, endDate));
    if (paymentMethod) conditions.push(eq(ledger.paymentMethod, paymentMethod));

    const rows = await db
      .select()
      .from(ledger)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ledger.receiptDate));

    console.log(`Fetched ${rows.length} Ledger records`);

    // Reverse links + processor lookup from services_rendered
    const linkedServices = rows.length > 0
      ? await db
          .select({
            id: servicesRendered.id,
            ledgerEntryId: servicesRendered.ledgerEntryId,
            processor: servicesRendered.processor,
          })
          .from(servicesRendered)
          .where(inArray(servicesRendered.ledgerEntryId, rows.map((r) => r.id)))
      : [];
    const serviceIdsByLedger = new Map<string, string[]>();
    const processorByLedger = new Map<string, string | null>();
    for (const s of linkedServices) {
      if (!s.ledgerEntryId) continue;
      const list = serviceIdsByLedger.get(s.ledgerEntryId) ?? [];
      list.push(s.id);
      serviceIdsByLedger.set(s.ledgerEntryId, list);
      if (!processorByLedger.has(s.ledgerEntryId)) processorByLedger.set(s.ledgerEntryId, s.processor);
    }

    let processedEntries = rows.map((row) => {
      const record = ledgerToAirtableRecord(row, serviceIdsByLedger.get(row.id), processorByLedger.get(row.id));
      return {
        id: row.id,
        fields: record.fields,
        clientName: row.nameOfClient || 'Unknown Client',
        serviceRendered: row.serviceRendered || 'Service',
        receiptDate: row.receiptDate || '',
        amountCharged: row.amountCharged != null ? Number(row.amountCharged) : 0,
        paymentMethod: row.paymentMethod || 'Unknown',
        processor: processorByLedger.get(row.id) || '',
        createdTime: row.createdAt.toISOString(),
      };
    });

    if (clientName) {
      const lowerClientName = clientName.toLowerCase();
      processedEntries = processedEntries.filter(e =>
        e.clientName.toLowerCase().includes(lowerClientName)
      );
    }

    const summary = {
      totalRevenue: processedEntries.reduce((sum, e) => sum + (e.amountCharged || 0), 0),
      totalEntries: processedEntries.length,
      uniqueClients: new Set(processedEntries.map(e => e.clientName)).size,
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
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ledger',
      },
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
