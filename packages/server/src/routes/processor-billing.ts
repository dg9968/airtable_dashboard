/**
 * Processor Billing Routes
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * GET /api/processor-billing
 * Fetch processor billing data from Bookkeeping Billing view
 */
app.get('/', async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env.local'
        },
        401
      );
    }

    const tableName = 'Subscriptions Corporate';
    const viewName = 'Bookkeeping Billing';
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    console.log(`Fetching view "${viewName}" from table "${tableName}"`);

    const records = await fetchAllRecords(baseId, tableName, {
      view: viewName
    });

    console.log(`Total records fetched: ${records.length}`);

    const stats = {
      totalRecords: records.length,
      tableName,
      viewName,
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

    let errorMessage = 'Failed to fetch processor billing data';
    let suggestion = 'Please check your configuration and try again';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('Table') && error.message.includes('not found')) {
        suggestion = 'Please check that the "Subscriptions Corporate" table exists in your Airtable base';
      } else if (error.message.includes('View') && error.message.includes('not found')) {
        suggestion = 'Please check that the "Bookkeeping Billing" view exists in your Subscriptions Corporate table';
      } else if (error.message.includes('AIRTABLE_PERSONAL_ACCESS_TOKEN')) {
        suggestion = 'Create a Personal Access Token at https://airtable.com/create/tokens with data.records:read scope';
      } else if (error.message.includes('AIRTABLE_BASE_ID')) {
        suggestion = 'Check your Base ID in the Airtable URL or API documentation';
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        suggestion
      },
      500
    );
  }
});

export default app;
