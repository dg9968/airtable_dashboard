/**
 * Services Rendered API Routes (Postgres-backed)
 *
 * Manages completed work awaiting billing or already billed (billing_records
 * — see db/schema/subscriptions.ts, TS name for the "services_rendered"
 * table). Completing a pipeline ticket never deletes it — client/service/
 * processor are still snapshotted onto the record for a stable display, but
 * the pipeline ticket and (for corporate) its billing bundle stay intact.
 * "Billing" here IS the ledger now: there's no separate ledger insert.
 */

import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  billingRecords,
  personalPipelineTickets,
  corporatePipelineTickets,
  billingNotes,
} from '../db/schema';
import {
  loadSubsPersonalContext,
  loadSubsCorporateContext,
  billingRecordToAirtableRecord,
  WIRE_BILLING_STATUSES,
} from '../db/serializers-subscriptions';

const app = new Hono();

type BillingRecordRow = typeof billingRecords.$inferSelect;

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
 * Create a new billing record when a pipeline ticket's work is completed.
 * The ticket itself is left untouched (no deletion) — client/service/
 * processor are snapshotted here purely for stable display.
 */
app.post('/', async (c) => {
  try {
    console.log('[Services Rendered API] POST / - Creating new billing record');

    const { subscriptionId, subscriptionType, serviceDate, amountCharged, notes, billingStatus } = await c.req.json();

    if (!subscriptionId || !subscriptionType || !serviceDate) {
      return c.json(
        { success: false, error: 'Missing required fields: subscriptionId, subscriptionType, serviceDate' },
        400
      );
    }

    if (subscriptionType !== 'personal' && subscriptionType !== 'corporate') {
      return c.json({ success: false, error: 'subscriptionType must be "personal" or "corporate"' }, 400);
    }

    const db = getDb();

    let clientName = 'Unknown Client';
    let serviceType = 'Unknown Service';
    let processor = 'Unassigned';
    let bundleItemId: string | null = null;

    if (subscriptionType === 'corporate') {
      const [ticket] = await db
        .select()
        .from(corporatePipelineTickets)
        .where(eq(corporatePipelineTickets.id, subscriptionId))
        .limit(1);
      if (!ticket) {
        return c.json({ success: false, error: 'Pipeline ticket not found in Subscriptions Corporate' }, 404);
      }
      const ctx = await loadSubsCorporateContext(db);
      const corp = ticket.corporationId ? ctx.corps.get(ticket.corporationId) : undefined;
      const serviceName = ticket.serviceId ? ctx.serviceNames.get(ticket.serviceId) : undefined;
      const processorInfo = ticket.processorId ? ctx.users.get(ticket.processorId) : undefined;
      clientName = corp?.company || 'Unknown Client';
      serviceType = serviceName || 'Unknown Service';
      processor = processorInfo?.name || 'Unassigned';
      bundleItemId = ticket.bundleItemId;
    } else {
      const [ticket] = await db
        .select()
        .from(personalPipelineTickets)
        .where(eq(personalPipelineTickets.id, subscriptionId))
        .limit(1);
      if (!ticket) {
        return c.json({ success: false, error: 'Pipeline ticket not found in Subscriptions Personal' }, 404);
      }
      const ctx = await loadSubsPersonalContext(db);
      const person = ticket.personalId ? ctx.persons.get(ticket.personalId) : undefined;
      const serviceName = ticket.serviceId ? ctx.serviceNames.get(ticket.serviceId) : undefined;
      const preparer = ticket.taxPreparerId ? ctx.users.get(ticket.taxPreparerId) : undefined;
      clientName = person?.fullName || 'Unknown Client';
      serviceType = serviceName || 'Unknown Service';
      processor = preparer?.name || 'Unassigned';
    }

    console.log('[Services Rendered API] Extracted values:', { clientName, serviceType, processor, bundleItemId });

    const finalBillingStatus =
      billingStatus && WIRE_BILLING_STATUSES.includes(billingStatus)
        ? billingStatus
        : bundleItemId
          ? 'Covered by Bundle'
          : 'Unbilled';
    // Bundle-covered work is never charged standalone — the bundle's
    // recurring total already accounts for it.
    const finalAmount = finalBillingStatus === 'Covered by Bundle' ? null : amountCharged ?? null;

    const [row] = await db
      .insert(billingRecords)
      .values({
        serviceRenderedDate: serviceDate.split('T')[0],
        billingStatus: finalBillingStatus,
        clientName,
        serviceType,
        processor,
        clientType: subscriptionType,
        subscriptionPersonalId: subscriptionType === 'personal' ? subscriptionId : null,
        subscriptionCorporateId: subscriptionType === 'corporate' ? subscriptionId : null,
        amountCharged: finalAmount != null ? String(finalAmount) : null,
        notes: notes || null,
      })
      .returning();

    const record = billingRecordToAirtableRecord(row);
    return c.json({
      success: true,
      data: {
        id: record.id,
        fields: record.fields,
        createdTime: record.createdTime,
      },
    });
  } catch (error) {
    console.error('Error creating billing record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create billing record',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/services-rendered
 * Fetch billing records with filtering and grouping
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
    if (status && status !== 'All') conditions.push(eq(billingRecords.billingStatus, status));
    // Legacy IS_AFTER / IS_BEFORE were strict comparisons
    if (startDate) conditions.push(gt(billingRecords.serviceRenderedDate, startDate));
    if (endDate) conditions.push(lt(billingRecords.serviceRenderedDate, endDate));

    const rows = await db
      .select()
      .from(billingRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(billingRecords.serviceRenderedDate));

    console.log(`Fetched ${rows.length} billing records`);

    const noteIds = await loadBillingNoteIds(rows.map((r) => r.id));

    let filteredRecords = rows.map((row) => {
      const record = billingRecordToAirtableRecord(row, noteIds.get(row.id));
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
      filteredRecords = filteredRecords.filter((r) => r.clientName.toLowerCase().includes(lowerClientName));
    }

    if (processor) {
      const lowerProcessor = processor.toLowerCase();
      filteredRecords = filteredRecords.filter((r) => r.processor.toLowerCase().includes(lowerProcessor));
    }

    if (clientType && clientType !== 'all') {
      filteredRecords = filteredRecords.filter((r) => r.clientType === clientType);
    }

    const summary = {
      totalServices: filteredRecords.length,
      totalAmount: filteredRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
      unbilledCount: filteredRecords.filter((r) => r.billingStatus === 'Unbilled').length,
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
    console.error('Error fetching billing records:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch billing records' },
      500
    );
  }
});

/**
 * Helper function to group records
 */
function groupRecords(records: any[], groupBy: 'client' | 'processor' | 'date') {
  const grouped: any = {};

  records.forEach((record) => {
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

  return Object.values(grouped).sort((a: any, b: any) => a.groupName.localeCompare(b.groupName));
}

/**
 * GET /api/services-rendered/:id
 * Get a single billing record by ID
 */
app.get('/:id', async (c) => {
  try {
    const recordId = c.req.param('id');
    const db = getDb();

    const [row] = await db.select().from(billingRecords).where(eq(billingRecords.id, recordId)).limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Billing record not found' }, 404);
    }

    const noteIds = await loadBillingNoteIds([row.id]);
    return c.json({
      success: true,
      data: billingRecordToAirtableRecord(row, noteIds.get(row.id)),
    });
  } catch (error) {
    console.error('Error fetching billing record:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch billing record' },
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
      return c.json({ success: false, error: 'Missing required field: billingStatus' }, 400);
    }

    if (!WIRE_BILLING_STATUSES.includes(billingStatus)) {
      return c.json(
        { success: false, error: `Invalid billing status. Must be one of: ${WIRE_BILLING_STATUSES.join(', ')}` },
        400
      );
    }

    console.log(`[Services Rendered API] Updating status for ${recordId} to ${billingStatus}`);

    const [row] = await getDb()
      .update(billingRecords)
      .set({ billingStatus })
      .where(eq(billingRecords.id, recordId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Billing record not found' }, 404);
    }

    return c.json({ success: true, data: billingRecordToAirtableRecord(row) });
  } catch (error) {
    console.error('Error updating billing status:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update billing status' },
      500
    );
  }
});

/** Legacy field names → billing_records (services_rendered) columns for PATCH bodies. */
function serviceFieldsToColumns(fields: Record<string, unknown>): Partial<typeof billingRecords.$inferInsert> {
  const out: Partial<typeof billingRecords.$inferInsert> = {};
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
    }
  }
  return out;
}

/**
 * PATCH /api/services-rendered/:id
 * Update a billing record (e.g., add amount, update notes)
 */
app.patch('/:id', async (c) => {
  try {
    const recordId = c.req.param('id');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json({ success: false, error: 'Missing fields object in request body' }, 400);
    }

    const [row] = await getDb()
      .update(billingRecords)
      .set(serviceFieldsToColumns(fields))
      .where(eq(billingRecords.id, recordId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Billing record not found' }, 404);
    }

    return c.json({ success: true, data: billingRecordToAirtableRecord(row) });
  } catch (error) {
    console.error('Error updating billing record:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update billing record' },
      500
    );
  }
});

/**
 * POST /api/services-rendered/:id/bill
 * Mark a billing record as billed/paid. The originating pipeline ticket
 * (and, for corporate clients, their billing bundle) is left untouched —
 * billing a one-off item no longer destroys the client's pipeline history.
 */
app.post('/:id/bill', async (c) => {
  try {
    const recordId = c.req.param('id');
    const { amountCharged, paymentMethod, receiptDate, billingStatus } = await c.req.json();

    if (!amountCharged || !paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        { success: false, error: 'Missing required fields: amountCharged, paymentMethod, receiptDate, billingStatus' },
        400
      );
    }

    if (!WIRE_BILLING_STATUSES.includes(billingStatus)) {
      return c.json(
        { success: false, error: `Invalid billing status. Must be one of: ${WIRE_BILLING_STATUSES.join(', ')}` },
        400
      );
    }

    const db = getDb();
    const [existing] = await db.select().from(billingRecords).where(eq(billingRecords.id, recordId)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: 'Billing record not found' }, 404);
    }

    const [updated] = await db
      .update(billingRecords)
      .set({
        billingStatus,
        amountCharged: String(amountCharged),
        paymentMethod,
        receiptDate: receiptDate.split('T')[0],
      })
      .where(eq(billingRecords.id, recordId))
      .returning();

    return c.json({
      success: true,
      data: { serviceRendered: billingRecordToAirtableRecord(updated) },
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
 * Bill multiple billing records at once. Pipeline tickets/bundles for the
 * billed records are left untouched.
 */
app.post('/batch-bill', async (c) => {
  try {
    const { serviceIds, paymentMethod, receiptDate, totalAmount, billingStatus, notes } = await c.req.json();

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return c.json({ success: false, error: 'serviceIds must be a non-empty array' }, 400);
    }

    if (!paymentMethod || !receiptDate || !billingStatus) {
      return c.json(
        { success: false, error: 'Missing required fields: paymentMethod, receiptDate, billingStatus' },
        400
      );
    }

    if (!WIRE_BILLING_STATUSES.includes(billingStatus)) {
      return c.json(
        { success: false, error: `Invalid billing status. Must be one of: ${WIRE_BILLING_STATUSES.join(', ')}` },
        400
      );
    }

    console.log(`Batch billing ${serviceIds.length} billing records`);

    const db = getDb();
    const rows = await db.select().from(billingRecords).where(inArray(billingRecords.id, serviceIds));

    let calculatedTotal = totalAmount;
    if (!calculatedTotal) {
      calculatedTotal = rows.reduce((sum, row) => sum + (row.amountCharged != null ? Number(row.amountCharged) : 0), 0);
    }

    const updatedRecords = [];
    for (const row of rows) {
      const updateValues: Partial<typeof billingRecords.$inferInsert> = {
        billingStatus,
        paymentMethod,
        receiptDate: receiptDate.split('T')[0],
      };

      if (row.amountCharged == null) {
        updateValues.amountCharged = String(calculatedTotal / serviceIds.length);
      }

      if (notes) {
        updateValues.notes = row.notes ? `${row.notes}\n\nBatch billing: ${notes}` : `Batch billing: ${notes}`;
      }

      const [updated] = await db
        .update(billingRecords)
        .set(updateValues)
        .where(eq(billingRecords.id, row.id))
        .returning();
      updatedRecords.push(billingRecordToAirtableRecord(updated));
    }

    return c.json({
      success: true,
      data: {
        updatedServices: updatedRecords,
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
