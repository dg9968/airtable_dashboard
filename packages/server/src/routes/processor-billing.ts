/**
 * Processor Billing Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { subscriptionsCorporate, servicesCorporate } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * GET /api/processor-billing
 * Fetch processor billing data (legacy "Bookkeeping Billing" Airtable view:
 * active Bookkeeping Clients subscriptions)
 */
app.get('/', async (c) => {
  try {
    const db = getDb();

    const rows = await db
      .select({ sub: subscriptionsCorporate })
      .from(subscriptionsCorporate)
      .innerJoin(servicesCorporate, eq(subscriptionsCorporate.serviceId, servicesCorporate.id))
      .where(
        and(
          eq(servicesCorporate.name, 'Bookkeeping Clients'),
          eq(subscriptionsCorporate.status, 'Active')
        )
      )
      .then((rs) => rs.map((r) => r.sub));

    const ctx = await loadSubsCorporateContext(db);
    const records = rows.map((row) => subsCorporateToAirtableRecord(row, ctx));

    console.log(`Total records fetched: ${records.length}`);

    const stats = {
      totalRecords: records.length,
      tableName: 'Subscriptions Corporate',
      viewName: 'Bookkeeping Billing',
      lastUpdated: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: {
        records,
        stats
      }
    });

  } catch (error) {
    console.error('Error in processor billing API route:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch processor billing data',
        suggestion: 'Check the database connection and try again'
      },
      500
    );
  }
});

export default app;
