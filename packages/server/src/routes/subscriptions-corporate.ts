/**
 * Subscriptions Corporate API Routes (Postgres-backed)
 *
 * Junction table that links corporations to corporate services. Responses keep
 * the legacy Airtable record shape. Legacy ?view= names map to service-name
 * filters — see CORPORATE_VIEW_FILTERS.
 */

import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporatePipelineTickets, servicesCorporate } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
  subsCorporateFieldsToColumns,
  CORPORATE_VIEW_FILTERS,
} from '../db/serializers-subscriptions';
import { notifyProcessorAssigned } from '../lib/notify-processor-assigned';
import { blockUnbilledCompletion } from '../lib/terminal-status-guard';

const app = new Hono();

/**
 * POST /api/subscriptions-corporate
 * Create a new subscription record linking a corporation to a corporate service.
 */
app.post('/', async (c) => {
  try {
    const { corporateId, serviceId, certificateId } = await c.req.json();

    if (!corporateId || !serviceId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: corporateId and serviceId',
        },
        400
      );
    }

    console.log('Creating Subscriptions Corporate record:', { corporateId, serviceId, certificateId });

    const db = getDb();
    const [row] = await db
      .insert(corporatePipelineTickets)
      .values({ corporationId: corporateId, serviceId, certificateId: certificateId ?? null })
      .returning();

    const ctx = await loadSubsCorporateContext(db);
    const record = subsCorporateToAirtableRecord(row, ctx);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error creating Subscriptions Corporate record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/subscriptions-corporate/bulk-assign
 *
 * Sets the processor on many tickets at once. Body:
 *   { ticketIds: string[], userId: string | null }   // null unassigns
 *
 * Deliberately does NOT call notifyProcessorAssigned. Assigning a backlog of
 * hundreds of tickets would send hundreds of individual emails; the same
 * reasoning is why scripts/reassign-tickets.ts bypasses the notification. The
 * single-ticket PATCH below still notifies as it always has.
 *
 * Registered before the '/:id' routes so the literal path can't be captured
 * as an id.
 */
app.post('/bulk-assign', async (c) => {
  try {
    const { ticketIds, userId } = await c.req.json();

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return c.json({ success: false, error: 'ticketIds must be a non-empty array' }, 400);
    }
    if (userId !== null && typeof userId !== 'string') {
      return c.json({ success: false, error: 'userId must be a string or null' }, 400);
    }

    const db = getDb();
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(corporatePipelineTickets)
        .set({ processorId: userId })
        .where(inArray(corporatePipelineTickets.id, ticketIds))
        .returning({ id: corporatePipelineTickets.id });
      return rows.length;
    });

    return c.json({ success: true, data: { updated, requested: ticketIds.length } });
  } catch (error) {
    console.error('Error bulk-assigning corporate tickets:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to bulk assign' },
      500
    );
  }
});

/**
 * GET /api/subscriptions-corporate
 * Get all subscription records (optionally filtered by legacy view name)
 */
app.get('/', async (c) => {
  try {
    const view = c.req.query('view');
    // Filter by an exact services_corporate.name. Preferred over ?view=, which
    // only understands the eleven legacy Airtable view names and so cannot
    // reach services added since (PO Box - 1414, Vault Management, ...). It
    // also avoids a name collision: the legacy view "Bookkeeping" means the
    // service "Bookkeeping Clients", while a separate service literally named
    // "Bookkeeping" also exists — ?view= can only ever select the former.
    const serviceName = c.req.query('serviceName');
    const db = getDb();

    // Unknown views fall back to all records (legacy behavior)
    const filter = serviceName
      ? { serviceName, activeOnly: false }
      : view && view in CORPORATE_VIEW_FILTERS
        ? CORPORATE_VIEW_FILTERS[view]
        : null;

    let rows;
    if (filter) {
      const conditions = [eq(servicesCorporate.name, filter.serviceName)];
      if (filter.activeOnly) conditions.push(eq(corporatePipelineTickets.status, 'Active'));
      rows = await db
        .select({ sub: corporatePipelineTickets })
        .from(corporatePipelineTickets)
        .innerJoin(servicesCorporate, eq(corporatePipelineTickets.serviceId, servicesCorporate.id))
        .where(and(...conditions))
        .then((rs) => rs.map((r) => r.sub));
    } else {
      rows = await db.select().from(corporatePipelineTickets);
    }

    const ctx = await loadSubsCorporateContext(db);
    const records = rows.map((row) => subsCorporateToAirtableRecord(row, ctx));

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
      },
      500
    );
  }
});

/**
 * GET /api/subscriptions-corporate/corporate/:corporateId
 * Get all subscriptions for a specific corporate record
 */
app.get('/corporate/:corporateId', async (c) => {
  try {
    const corporateId = c.req.param('corporateId');
    const db = getDb();

    const rows = await db
      .select()
      .from(corporatePipelineTickets)
      .where(eq(corporatePipelineTickets.corporationId, corporateId));

    const ctx = await loadSubsCorporateContext(db);
    const records = rows.map((row) => subsCorporateToAirtableRecord(row, ctx));

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching corporate subscriptions:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
      },
      500
    );
  }
});

/**
 * PATCH /api/subscriptions-corporate/:id
 * Update a subscription record (e.g., assign processor, update status)
 */
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json(
        {
          success: false,
          error: 'Missing fields to update',
        },
        400
      );
    }

    console.log('Updating Subscriptions Corporate record:', id);
    console.log('Fields to update:', JSON.stringify(fields, null, 2));

    const db = getDb();
    const values = subsCorporateFieldsToColumns(fields);

    // Work can't be marked done here without a charge on file — see
    // lib/terminal-status-guard.ts. Use POST /api/service-completion instead.
    if ('status' in values) {
      const blocked = await blockUnbilledCompletion(db, 'corporate', id, values.status);
      if (blocked) return c.json({ success: false, error: blocked }, 409);
    }

    const [existing] = await db
      .select({ processorId: corporatePipelineTickets.processorId })
      .from(corporatePipelineTickets)
      .where(eq(corporatePipelineTickets.id, id));

    const [row] = await db
      .update(corporatePipelineTickets)
      .set(values)
      .where(eq(corporatePipelineTickets.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const ctx = await loadSubsCorporateContext(db);
    const record = subsCorporateToAirtableRecord(row, ctx);

    // Email the newly-assigned processor — skip on unassignment (processorId
    // cleared) or a no-op reassignment (same processor as before).
    if ('processorId' in values && row.processorId && row.processorId !== existing?.processorId) {
      const processor = ctx.users.get(row.processorId);
      if (processor?.email) {
        await notifyProcessorAssigned({
          ticketId: row.id,
          processor,
          company: (row.corporationId && ctx.corps.get(row.corporationId)?.company) || 'Unknown company',
          serviceName: (row.serviceId && ctx.serviceNames.get(row.serviceId)) || 'Unknown service',
        });
      }
    }

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update subscription',
        details: error instanceof Error ? error.stack : String(error),
      },
      500
    );
  }
});

/**
 * DELETE /api/subscriptions-corporate/:id
 * Delete a subscription record
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    await getDb().delete(corporatePipelineTickets).where(eq(corporatePipelineTickets.id, id));

    return c.json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete subscription',
      },
      500
    );
  }
});

export default app;
