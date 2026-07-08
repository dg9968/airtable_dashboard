/**
 * Customer Subscriptions Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { subscriptionsCorporate, corporations } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * GET /api/customer-subscriptions?customer=CustomerName
 * Fetch all subscriptions for a specific customer (matched by company name)
 */
app.get('/', async (c) => {
  try {
    const customerName = c.req.query('customer');

    if (!customerName) {
      return c.json(
        { success: false, error: 'Customer name is required' },
        400
      );
    }

    console.log(`Fetching subscriptions for customer: ${customerName}`);

    const db = getDb();
    const rows = await db
      .select({ sub: subscriptionsCorporate })
      .from(subscriptionsCorporate)
      .innerJoin(corporations, eq(subscriptionsCorporate.corporationId, corporations.id))
      .where(eq(corporations.company, customerName))
      .then((rs) => rs.map((r) => r.sub));

    const ctx = await loadSubsCorporateContext(db);

    const subscriptions = rows.map((row) => {
      const record = subsCorporateToAirtableRecord(row, ctx);
      const subscriptionName = String(record.fields['Name'] || '');
      const serviceName = subscriptionName.replace(customerName + ' - ', '');

      return {
        id: record.id,
        clientId: customerName,
        serviceId: serviceName,
        status: record.fields['Status'] ? [record.fields['Status']] : [],
        price: Number(record.fields['Billing Amount']) || 0,
        fields: record.fields
      };
    });

    console.log(`Found ${subscriptions.length} subscriptions for ${customerName}`);

    return c.json({
      success: true,
      data: subscriptions,
      customerName: customerName,
      totalRecords: subscriptions.length
    });

  } catch (error) {
    console.error('Error fetching customer subscriptions:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer subscriptions'
      },
      500
    );
  }
});

export default app;
