/**
 * Subscriptions Personal API Routes (Postgres-backed)
 *
 * Junction table that links personal records to services (Tax Prep Pipeline etc).
 * Responses keep the legacy Airtable record shape. The legacy ?view= parameter
 * (Airtable view names) maps to service-name filters — see PERSONAL_VIEW_FILTERS.
 */

import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { subscriptionsPersonal, personalServices } from '../db/schema';
import {
  loadSubsPersonalContext,
  subsPersonalToAirtableRecord,
  subsPersonalFieldsToColumns,
  PERSONAL_VIEW_FILTERS,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * POST /api/subscriptions-personal
 * Create a new subscription record linking a personal record to a service.
 */
app.post('/', async (c) => {
  try {
    const { personalId, serviceId } = await c.req.json();

    if (!personalId || !serviceId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: personalId and serviceId',
        },
        400
      );
    }

    console.log('Creating Subscriptions Personal record:', { personalId, serviceId });

    const db = getDb();

    // Guard against duplicates (authoritative server-side check)
    const [duplicate] = await db
      .select()
      .from(subscriptionsPersonal)
      .where(
        and(
          eq(subscriptionsPersonal.personalId, personalId),
          eq(subscriptionsPersonal.serviceId, serviceId)
        )
      )
      .limit(1);

    const ctx = await loadSubsPersonalContext(db);

    if (duplicate) {
      console.log('Subscription already exists, returning existing record:', duplicate.id);
      const record = subsPersonalToAirtableRecord(duplicate, ctx);
      return c.json({
        success: true,
        data: { id: record.id, fields: record.fields },
      });
    }

    const [row] = await db
      .insert(subscriptionsPersonal)
      .values({ personalId, serviceId })
      .returning();

    const record = subsPersonalToAirtableRecord(row, ctx);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error creating Subscriptions Personal record:', error);
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
 * GET /api/subscriptions-personal
 * Get all subscription records (optionally filtered by legacy view name).
 * Defaults to "Tax Prep Pipeline" for backward compatibility.
 */
app.get('/', async (c) => {
  try {
    const view = c.req.query('view');
    const targetView = view || 'Tax Prep Pipeline';

    const db = getDb();
    // Unknown view names fall back to Tax Prep Pipeline (legacy behavior)
    const filter =
      targetView in PERSONAL_VIEW_FILTERS
        ? PERSONAL_VIEW_FILTERS[targetView]
        : PERSONAL_VIEW_FILTERS['Tax Prep Pipeline'];

    let rows;
    if (filter) {
      rows = await db
        .select({ sub: subscriptionsPersonal })
        .from(subscriptionsPersonal)
        .innerJoin(personalServices, eq(subscriptionsPersonal.serviceId, personalServices.id))
        .where(eq(personalServices.name, filter.serviceName))
        .then((rs) => rs.map((r) => r.sub));
    } else {
      rows = await db.select().from(subscriptionsPersonal);
    }

    const ctx = await loadSubsPersonalContext(db);
    const records = rows.map((row) => subsPersonalToAirtableRecord(row, ctx));

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
 * GET /api/subscriptions-personal/personal/:personalId
 * Get all subscriptions for a specific personal record
 */
app.get('/personal/:personalId', async (c) => {
  try {
    const personalId = c.req.param('personalId');
    const db = getDb();

    const rows = await db
      .select()
      .from(subscriptionsPersonal)
      .where(eq(subscriptionsPersonal.personalId, personalId));

    const ctx = await loadSubsPersonalContext(db);
    const records = rows.map((row) => subsPersonalToAirtableRecord(row, ctx));

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching personal subscriptions:', error);
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
 * PATCH /api/subscriptions-personal/:id
 * Update a subscription record (e.g., assign tax preparer)
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

    console.log('Updating Subscriptions Personal record:', id);
    console.log('Fields to update:', JSON.stringify(fields, null, 2));

    const db = getDb();
    const values = subsPersonalFieldsToColumns(fields);

    const [row] = await db
      .update(subscriptionsPersonal)
      .set(values)
      .where(eq(subscriptionsPersonal.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const ctx = await loadSubsPersonalContext(db);
    const record = subsPersonalToAirtableRecord(row, ctx);

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
 * DELETE /api/subscriptions-personal/:id
 * Delete a subscription record
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    await getDb().delete(subscriptionsPersonal).where(eq(subscriptionsPersonal.id, id));

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
