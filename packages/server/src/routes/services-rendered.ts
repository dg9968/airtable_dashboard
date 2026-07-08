/**
 * Services Rendered API Routes (Postgres-backed)
 *
 * Manages completed services that are awaiting billing or have been billed.
 * Client/service/processor names are stored values (not lookups) so they
 * survive subscription deletion at billing time — same design as before.
 */

import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  servicesRendered,
  subscriptionsPersonal,
  subscriptionsCorporate,
  ledger,
  billingNotes,
} from '../db/schema';
import {
  loadSubsPersonalContext,
  loadSubsCorporateContext,
  subsPersonalToAirtableRecord,
  subsCorporateToAirtableRecord,
  servicesRenderedToAirtableRecord,
  ledgerToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

type ServiceRow = typeof servicesRendered.$inferSelect;

const VALID_STATUSES = ['Unbilled', 'Billed - Paid', 'Billed - Unpaid', 'Waived', 'Part of Subscription'];

async function loadBillingNoteIds(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const notes = await getDb()
    .select({ id: billingNotes.id, servicesRenderedId: billingNotes.servicesRenderedId })
    .from(billingNotes)
    .where(inArray(billingNotes.servicesRenderedId, ids));
  for (const n of notes) {
    if (!n.servicesRenderedId) continue;
    const list = map.get(n.servicesRenderedId) ?? [];
    list.push(n.id);
    map.set(n.servicesRenderedId, list);
  }
  return map;
}

/**
 * POST /api/services-rendered
 * Create a new unbilled service record when a service is completed
 */
app.post('/', async (c) => {
  try {
    console.log('[Services Rendered API] POST / - Creating new service record');

    const { subscriptionId, subscriptionType, serviceDate, amountCharged, notes, billingStatus } = await c.req.json();

    if (!subscriptionId || !subscriptionType || !serviceDate) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, subscriptionType, serviceDate',
        },
        400
      );
    }

    if (subscriptionType !== 'personal' && subscriptionType !== 'corporate') {
      return c.json(
        {
          success: false,
          error: 'subscriptionType must be "personal" or "corporate"',
        },
        400
      );
    }

    const db = getDb();

    // Extract stored values from the subscription (client/service/processor)
    let clientName = 'Unknown Client';
    let serviceType = 'Unknown Service';
    let processor = 'Unassigned';

    if (subscriptionType === 'corporate') {
      const [sub] = await db
        .select()
        .from(subscriptionsCorporate)
        .where(eq(subscriptionsCorporate.id, subscriptionId))
        .limit(1);
      if (!sub) {
        return c.json({ success: false, error: 'Subscription not found in Subscriptions Corporate' }, 404);
      }
      const ctx = await loadSubsCorporateContext(db);
      const fields = subsCorporateToAirtableRecord(sub, ctx).fields as Record<string, any>;
      clientName = fields['Company  (from Customer)']?.[0] || 'Unknown Client';
      serviceType = fields['Service Name']?.[0] || 'Unknown Service';
      processor = fields['Name (from Processor)']?.[0] || 'Unassigned';
    } else {
      const [sub] = await db
        .select()
        .from(subscriptionsPersonal)
        .where(eq(subscriptionsPersonal.id, subscriptionId))
        .limit(1);
      if (!sub) {
        return c.json({ success: false, error: 'Subscription not found in Subscriptions Personal' }, 404);
      }
      const ctx = await loadSubsPersonalContext(db);
      const fields = subsPersonalToAirtableRecord(sub, ctx).fields as Record<string, any>;
      clientName = fields['Full Name']?.[0] || 'Unknown Client';
      serviceType = fields['Service Name (from Service)']?.[0] || 'Unknown Service';
      processor = fields['Name (from Team Link)']?.[0] || fields['Processor'] || 'Unassigned';
    }

    console.log('[Services Rendered API] Extracted values:', { clientName, serviceType, processor });

    const finalBillingStatus = billingStatus && VALID_STATUSES.includes(billingStatus) ? billingStatus : 'Unbilled';

    const [row] = await db
      .insert(servicesRendered)
      .values({
        serviceRenderedDate: serviceDate.split('T')[0],
        billingStatus: finalBillingStatus,
        clientName,
        serviceType,
        processor,
        clientType: subscriptionType,
        subscriptionPersonalId: subscriptionType === 'personal' ? subscriptionId : null,
        subscriptionCorporateId: subscriptionType === 'corporate' ? subscriptionId : null,
        amountCharged: amountCharged !== undefined && amountCharged !== null ? String(amountCharged) : null,
        notes: notes || null,
      })
      .returning();

    const record = servicesRenderedToAirtableRecord(row);
    return c.json({
      success: true,
      data: {
        id: record.id,
        fields: record.fields,
        createdTime: record.createdTime,
      },
    });
  } catch (error) {
    console.error('Error creating Services Rendered entry:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create services rendered entry',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/services-rendered
 * Fetch services rendered with filtering and grouping
 */
app.get('/', async (c) => {
  try {
    const db = getDb();

    const status = c.req.query('status');
    const clientName = c.req.query('clientName');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const processor = c.req.query('processor');
    const groupBy = c.req.query('groupBy') || 'client';
    const clientType = c.req.query('clientType');

    const conditions = [];
    if (status && status !== 'All') conditions.push(eq(servicesRendered.billingStatus, status));
    // Legacy IS_AFTER / IS_BEFORE were strict comparisons
    if (startDate) conditions.push(gt(servicesRendered.serviceRenderedDate, startDate));
    if (endDate) conditions.push(lt(servicesRendered.serviceRenderedDate, endDate));

    const rows = await db
      .select()
      .from(servicesRendered)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(servicesRendered.serviceRenderedDate));

    console.log(`Fetched ${rows.length} Services Rendered records`);

    const noteIds = await loadBillingNoteIds(rows.map((r) => r.id));

    let filteredRecords = rows.map((row) => {
      const record = servicesRenderedToAirtableRecord(row, noteIds.get(row.id));
      return {
        id: row.id,
        fields: record.fields,
        clientName: row.clientName || 'Unknown Client',
        serviceType: row.serviceType || 'Unknown Service',
        processor: row.processor || 'Unassigned',
        clientType: row.clientType || null,
        amount: row.amountCharged != null ? Number(row.amountCharged) : 0,
        serviceDate: row.serviceRenderedDate ?? undefined,
        billingStatus: row.billingStatus ?? undefined,
        paymentMethod: row.paymentMethod ?? undefined,
        receiptDate: row.receiptDate ?? undefined,
        notes: row.notes ?? undefined,
      };
    });

    if (clientName) {
      const lowerClientName = clientName.toLowerCase();
      filteredRecords = filteredRecords.filter(r =>
        r.clientName.toLowerCase().includes(lowerClientName)
      );
    }

    if (processor) {
      const lowerProcessor = processor.toLowerCase();
      filteredRecords = filteredRecords.filter(r =>
        r.processor.toLowerCase().includes(lowerProcessor)
      );
    }

    if (clientType && clientType !== 'all') {
      filteredRecords = filteredRecords.filter(r => r.clientType === clientType);
    }

    const summary = {
      totalServices: filteredRecords.length,
      totalAmount: filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
      unbilledCount: filteredRecords.filter(r => r.billingStatus === 'Unbilled').length,
    };

    const grouped = groupRecords(filteredRecords, groupBy as 'client' | 'processor' | 'date');

    return c.json({
      success: true,
      data: {
        services: filteredRecords,
        summary,
        groupedBy: groupBy,
        grouped,
      },
    });
  } catch (error) {
    console.error('Error fetching services rendered:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services rendered',
      },
      500
    );
  }
});

/**
 * Helper function to group records
 */
function groupRecords(records: any[], groupBy: 'client' | 'processor' | 'date') {
  const grouped: any = {};

  records.forEach(record => {
    let key = '';

    switch (groupBy) {
      case 'client':
        key = record.clientName;
        break;
      case 'processor':
        key = record.processor;
        break;
      case 'date':
        key = record.serviceDate || 'No Date';
        break;
    }

    if (!grouped[key]) {
      grouped[key] = {
        groupName: key,
        services: [],
        totalAmount: 0,
        count: 0,
      };
    }

    grouped[key].services.push(record);
    grouped[key].totalAmount += record.amount || 0;
    grouped[key].count++;
  });

  return Object.values(grouped).sort((a: any, b: any) =>
    a.groupName.localeCompare(b.groupName)
  );
}

/**
 * GET /api/services-rendered/:id
 * Get a single service record by ID
 */
app.get('/:id', async (c) => {
  try {
    const recordId = c.req.param('id');
    const db = getDb();

    const [row] = await db.select().from(servicesRendered).where(eq(servicesRendered.id, recordId)).limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Service record not found' }, 404);
    }

    const noteIds = await loadBillingNoteIds([row.id]);
    return c.json({
      success: true,
      data: servicesRenderedToAirtableRecord(row, noteIds.get(row.id)),
    });
  } catch (error) {
    console.error('Error fetching service record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch service record',
      },
      500
    );
  }
});

/**
 * PATCH /api/services-rendered/:id/status
 * Quick update of billing status only
 */
app.patch('/:id/status', async (c) => {
  try {
    const recordId = c.req.param('id');
    const { billingStatus } = await c.req.json();

    if (!billingStatus) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: billingStatus',
        },
        400
      );
    }

    if (!VALID_STATUSES.includes(billingStatus)) {
      return c.json(
        {
          success: false,
          error: `Invalid billing status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        400
      );
    }

    console.log(`[Services Rendered API] Updating status for ${recordId} to ${billingStatus}`);

    const [row] = await getDb()
      .update(servicesRendered)
      .set({ billingStatus })
      .where(eq(servicesRendered.id, recordId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Service record not found' }, 404);
    }

    return c.json({
      success: true,
      data: servicesRenderedToAirtableRecord(row),
    });
  } catch (error) {
    console.error('Error updating billing status:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update billing status',
      },
      500
    );
  }
});

/** Legacy field names → services_rendered columns for PATCH bodies. */
function serviceFieldsToColumns(fields: Record<string, unknown>): Partial<typeof servicesRendered.$inferInsert> {
  const out: Partial<typeof servicesRendered.$inferInsert> = {};
  const first = (v: unknown) => (Array.isArray(v) ? (v[0] as string | undefined) ?? null : (v as string | null));
  for (const [key, value] of Object.entries(fields)) {
    switch (key) {
      case 'Billing Status': out.billingStatus = (value as string) || null; break;
      case 'Amount Charged': out.amountCharged = value == null ? null : String(value); break;
      case 'Payment Method': out.paymentMethod = (value as string) || null; break;
      case 'Receipt Date': out.receiptDate = (value as string) || null; break;
      case 'Notes': out.notes = (value as string) || null; break;
      case 'Client Name': out.clientName = (value as string) || null; break;
      case 'Service Type': out.serviceType = (value as string) || null; break;
      case 'Processor': out.processor = (value as string) || null; break;
      case 'Service Rendered Date': out.serviceRenderedDate = (value as string) || null; break;
      case 'Ledger Entry': out.ledgerEntryId = first(value); break;
    }
  }
  return out;
}

/**
 * PATCH /api/services-rendered/:id
 * Update a service record (e.g., add amount, update notes)
 */
app.patch('/:id', async (c) => {
  try {
    const recordId = c.req.param('id');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json(
        {
          success: false,
          error: 'Missing fields object in request body',
        },
        400
      );
    }

    const [row] = await getDb()
      .update(servicesRendered)
      .set(serviceFieldsToColumns(fields))
      .where(eq(servicesRendered.id, recordId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Service record not found' }, 404);
    }

    return c.json({
      success: true,
      data: servicesRenderedToAirtableRecord(row),
    });
  } catch (error) {
    console.error('Error updating service record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service record',
      },
      500
    );
  }
});

/** Shared: delete a billed subscription (personal or corporate); tolerant of already-deleted. */
async function deleteSubscription(subscriptionType: 'personal' | 'corporate', subscriptionId: string) {
  const db = getDb();
  try {
    if (subscriptionType === 'corporate') {
      await db.delete(subscriptionsCorporate).where(eq(subscriptionsCorporate.id, subscriptionId));
    } else {
      await db.delete(subscriptionsPersonal).where(eq(subscriptionsPersonal.id, subscriptionId));
    }
    console.log('[Services Rendered API] Subscription deleted successfully');
  } catch (error) {
    console.error('[Services Rendered API] Failed to delete subscription:', error);
  }
}

/**
 * POST /api/services-rendered/:id/bill
 * Mark a service as billed and optionally create a Ledger entry
 */
app.post('/:id/bill', async (c) => {
  try {
    const recordId = c.req.param('id');
    const { amountCharged, paymentMethod, receiptDate, createLedger, billingStatus } = await c.req.json();

    if (!amountCharged || !paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: amountCharged, paymentMethod, receiptDate, billingStatus',
        },
        400
      );
    }

    const db = getDb();
    const [serviceRow] = await db.select().from(servicesRendered).where(eq(servicesRendered.id, recordId)).limit(1);
    if (!serviceRow) {
      return c.json({ success: false, error: 'Service record not found' }, 404);
    }

    const updateValues: Partial<typeof servicesRendered.$inferInsert> = {
      billingStatus,
      amountCharged: String(amountCharged),
      paymentMethod,
      receiptDate: receiptDate.split('T')[0],
    };

    let ledgerEntry = null;

    if (createLedger && billingStatus === 'Billed - Paid') {
      console.log('[Services Rendered API] Creating Ledger entry for service:', recordId);

      const subscriptionType = serviceRow.subscriptionCorporateId ? 'corporate' : 'personal';
      const subscriptionId = serviceRow.subscriptionCorporateId || serviceRow.subscriptionPersonalId;

      const [ledgerRow] = await db
        .insert(ledger)
        .values({
          serviceRendered: serviceRow.serviceType || 'Service',
          receiptDate: receiptDate.split('T')[0],
          amountCharged: String(amountCharged),
          nameOfClient: serviceRow.clientName || 'Unknown Client',
          paymentMethod,
          subscriptionPersonalId: subscriptionType === 'personal' ? subscriptionId : null,
          subscriptionCorporateId: subscriptionType === 'corporate' ? subscriptionId : null,
        })
        .returning();

      ledgerEntry = ledgerToAirtableRecord(ledgerRow, [recordId], serviceRow.processor);
      updateValues.ledgerEntryId = ledgerRow.id;

      // Delete the subscription record now that it's billed and in the ledger
      if (subscriptionId) {
        console.log(`[Services Rendered API] Deleting subscription ${subscriptionId}`);
        await deleteSubscription(subscriptionType, subscriptionId);
      }
    }

    const [updated] = await db
      .update(servicesRendered)
      .set(updateValues)
      .where(eq(servicesRendered.id, recordId))
      .returning();

    return c.json({
      success: true,
      data: {
        serviceRendered: servicesRenderedToAirtableRecord(updated),
        ledgerEntry,
      },
    });
  } catch (error) {
    console.error('Error billing service:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bill service',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/services-rendered/batch-bill
 * Bill multiple services at once
 */
app.post('/batch-bill', async (c) => {
  try {
    const { serviceIds, paymentMethod, receiptDate, totalAmount, createLedger, billingStatus, notes } = await c.req.json();

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return c.json(
        {
          success: false,
          error: 'serviceIds must be a non-empty array',
        },
        400
      );
    }

    if (!paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: paymentMethod, receiptDate, billingStatus',
        },
        400
      );
    }

    console.log(`Batch billing ${serviceIds.length} services`);

    const db = getDb();
    const serviceRows = await db.select().from(servicesRendered).where(inArray(servicesRendered.id, serviceIds));

    let calculatedTotal = totalAmount;
    if (!calculatedTotal) {
      calculatedTotal = serviceRows.reduce((sum, row) => sum + (row.amountCharged != null ? Number(row.amountCharged) : 0), 0);
    }

    let ledgerEntry = null;

    if (createLedger && billingStatus === 'Billed - Paid') {
      const firstService = serviceRows[0];
      const subscriptionType = firstService.subscriptionCorporateId ? 'corporate' : 'personal';
      const subscriptionId = firstService.subscriptionCorporateId || firstService.subscriptionPersonalId;

      const serviceDescriptions = serviceRows.map((r) => r.serviceType).filter(Boolean);
      const serviceDescription = serviceDescriptions.length > 0
        ? `Batch: ${serviceDescriptions.join(', ')}`
        : 'Batch Billing';

      const [ledgerRow] = await db
        .insert(ledger)
        .values({
          serviceRendered: serviceDescription,
          receiptDate: receiptDate.split('T')[0],
          amountCharged: String(calculatedTotal),
          nameOfClient: firstService.clientName || 'Unknown Client',
          paymentMethod,
          subscriptionPersonalId: subscriptionType === 'personal' ? subscriptionId : null,
          subscriptionCorporateId: subscriptionType === 'corporate' ? subscriptionId : null,
        })
        .returning();

      ledgerEntry = ledgerToAirtableRecord(ledgerRow, serviceIds, firstService.processor);

      // Delete all linked subscriptions for the billed services
      const personalIds = [...new Set(serviceRows.map((r) => r.subscriptionPersonalId).filter(Boolean))] as string[];
      const corporateIds = [...new Set(serviceRows.map((r) => r.subscriptionCorporateId).filter(Boolean))] as string[];
      if (personalIds.length > 0) {
        console.log(`[Services Rendered API] Deleting ${personalIds.length} personal subscriptions`);
        await db.delete(subscriptionsPersonal).where(inArray(subscriptionsPersonal.id, personalIds));
      }
      if (corporateIds.length > 0) {
        console.log(`[Services Rendered API] Deleting ${corporateIds.length} corporate subscriptions`);
        await db.delete(subscriptionsCorporate).where(inArray(subscriptionsCorporate.id, corporateIds));
      }
    }

    // Update all service records
    const updatedRecords = [];
    for (const row of serviceRows) {
      const updateValues: Partial<typeof servicesRendered.$inferInsert> = {
        billingStatus,
        paymentMethod,
        receiptDate: receiptDate.split('T')[0],
      };

      if (row.amountCharged == null) {
        updateValues.amountCharged = String(calculatedTotal / serviceIds.length);
      }

      if (ledgerEntry) {
        updateValues.ledgerEntryId = ledgerEntry.id;
      }

      if (notes) {
        updateValues.notes = row.notes
          ? `${row.notes}\n\nBatch billing: ${notes}`
          : `Batch billing: ${notes}`;
      }

      const [updated] = await db
        .update(servicesRendered)
        .set(updateValues)
        .where(eq(servicesRendered.id, row.id))
        .returning();
      updatedRecords.push(servicesRenderedToAirtableRecord(updated));
    }

    return c.json({
      success: true,
      data: {
        updatedServices: updatedRecords,
        ledgerEntry,
        summary: {
          totalBilled: serviceIds.length,
          totalAmount: calculatedTotal,
        },
      },
    });
  } catch (error) {
    console.error('Error batch billing services:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch bill services',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

export default app;
