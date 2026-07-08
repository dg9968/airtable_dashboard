/**
 * Subscriptions Corporate API Routes (Postgres-backed)
 *
 * Junction table that links corporations to corporate services. Responses keep
 * the legacy Airtable record shape. Legacy ?view= names map to service-name
 * filters — see CORPORATE_VIEW_FILTERS.
 */

import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { subscriptionsCorporate, servicesCorporate } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
  subsCorporateFieldsToColumns,
  CORPORATE_VIEW_FILTERS,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * POST /api/subscriptions-corporate
 * Create a new subscription record linking a corporation to a corporate service.
 */
app.post('/', async (c) => {
  try {
    const { corporateId, serviceId } = await c.req.json();

    if (!corporateId || !serviceId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: corporateId and serviceId',
        },
        400
      );
    }

    console.log('Creating Subscriptions Corporate record:', { corporateId, serviceId });

    const db = getDb();
    const [row] = await db
      .insert(subscriptionsCorporate)
      .values({ corporationId: corporateId, serviceId })
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
 * GET /api/subscriptions-corporate
 * Get all subscription records (optionally filtered by legacy view name)
 */
app.get('/', async (c) => {
  try {
    const view = c.req.query('view');
    const db = getDb();

    // Unknown views fall back to all records (legacy behavior)
    const filter = view && view in CORPORATE_VIEW_FILTERS ? CORPORATE_VIEW_FILTERS[view] : null;

    let rows;
    if (filter) {
      const conditions = [eq(servicesCorporate.name, filter.serviceName)];
      if (filter.activeOnly) conditions.push(eq(subscriptionsCorporate.status, 'Active'));
      rows = await db
        .select({ sub: subscriptionsCorporate })
        .from(subscriptionsCorporate)
        .innerJoin(servicesCorporate, eq(subscriptionsCorporate.serviceId, servicesCorporate.id))
        .where(and(...conditions))
        .then((rs) => rs.map((r) => r.sub));
    } else {
      rows = await db.select().from(subscriptionsCorporate);
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
      .from(subscriptionsCorporate)
      .where(eq(subscriptionsCorporate.corporationId, corporateId));

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

    const [row] = await db
      .update(subscriptionsCorporate)
      .set(values)
      .where(eq(subscriptionsCorporate.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const ctx = await loadSubsCorporateContext(db);
    const record = subsCorporateToAirtableRecord(row, ctx);

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

    await getDb().delete(subscriptionsCorporate).where(eq(subscriptionsCorporate.id, id));

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
