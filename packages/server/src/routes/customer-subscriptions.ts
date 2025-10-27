/**
 * Customer Subscriptions Routes
 */

import { Hono } from 'hono';
import { fetchRecords } from '../lib/airtable-service';

const app = new Hono();

/**
 * GET /api/customer-subscriptions?customer=CustomerName
 * Fetch all subscriptions for a specific customer
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

    const records = await fetchRecords('Subscriptions Corporate', {
      view: 'Services by Client All',
      filterByFormula: `SEARCH("${customerName} - ", {Name}) = 1`,
      maxRecords: 100
    });

    const subscriptions = records.map((record) => {
      const subscriptionName = String(record.fields['Name'] || '');
      const serviceName = subscriptionName.replace(customerName + ' - ', '');

      return {
        id: record.id,
        clientId: customerName,
        serviceId: serviceName,
        status: Array.isArray(record.fields['Status']) ? record.fields['Status'] : [],
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
