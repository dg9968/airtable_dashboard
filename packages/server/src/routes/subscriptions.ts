/**
 * Subscriptions Routes (Postgres-backed)
 * Legacy generic create/update/delete against subscriptions_corporate.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { subscriptionsCorporate } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
app.post('/', async (c) => {
  try {
    const { subscriptionName, status, price } = await c.req.json();

    console.log('Creating subscription with data:', { subscriptionName, status, price });

    if (!subscriptionName) {
      return c.json(
        { success: false, error: 'Missing required field: subscriptionName' },
        400
      );
    }

    // Legacy behavior: "Name" was an Airtable formula, so only status/price
    // actually persist; the name comes from linked company + service.
    const db = getDb();
    const [row] = await db
      .insert(subscriptionsCorporate)
      .values({
        status: status !== undefined && status !== '' ? status : null,
        billingAmount: price !== undefined ? String(price) : null,
      })
      .returning();

    const ctx = await loadSubsCorporateContext(db);
    const record = subsCorporateToAirtableRecord(row, ctx);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields }
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      500
    );
  }
});

/**
 * PATCH /api/subscriptions
 * Update an existing subscription
 */
app.patch('/', async (c) => {
  try {
    const { subscriptionId, status, price } = await c.req.json();

    console.log('Updating subscription with data:', { subscriptionId, status, price });

    if (!subscriptionId) {
      return c.json(
        { success: false, error: 'Missing required field: subscriptionId' },
        400
      );
    }

    const values: Partial<typeof subscriptionsCorporate.$inferInsert> = {};

    if (status !== undefined) {
      values.status = status === '' || status === null ? null : status;
    }

    if (price !== undefined) {
      values.billingAmount = String(price);
    }

    const db = getDb();
    const [row] = await db
      .update(subscriptionsCorporate)
      .set(values)
      .where(eq(subscriptionsCorporate.id, subscriptionId))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const ctx = await loadSubsCorporateContext(db);
    const record = subsCorporateToAirtableRecord(row, ctx);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields }
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      500
    );
  }
});

/**
 * DELETE /api/subscriptions?id=recordId
 * Delete a subscription
 */
app.delete('/', async (c) => {
  try {
    const subscriptionId = c.req.query('id');

    if (!subscriptionId) {
      return c.json(
        { success: false, error: 'Missing subscription ID' },
        400
      );
    }

    await getDb().delete(subscriptionsCorporate).where(eq(subscriptionsCorporate.id, subscriptionId));

    return c.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting subscription:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete subscription'
      },
      500
    );
  }
});

export default app;
