/**
 * Subscriptions Corporate API Routes
 *
 * Junction table that links Corporate (Corporations) records to Services Corporate (e.g., Reconciling Banks for Tax Prep)
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords, createRecords, updateRecords, deleteRecords } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * POST /api/subscriptions-corporate
 * Create a new subscription record linking Corporations to Services Corporate
 *
 * Expected body:
 * {
 *   corporateId: string,  // Airtable record ID from Corporations table
 *   serviceId: string     // Airtable record ID from Services Corporate table
 * }
 */
app.post('/', async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
        },
        401
      );
    }

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

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the junction record
    // Field names: "Customer" links to Corporations, "Services" links to Services Corporate
    const recordData: any = {
      'Customer': [corporateId],  // Link to Corporations table
      'Services': [serviceId],     // Link to Services Corporate table
    };

    const records = await createRecords(baseId, 'Subscriptions Corporate', [
      { fields: recordData },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
      },
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
 * Get all subscription records (optionally filtered by view)
 */
app.get('/', async (c) => {
  try {
    const view = c.req.query('view');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    let records;

    // Try with view first if provided
    if (view) {
      try {
        records = await fetchAllRecords(baseId, 'Subscriptions Corporate', { view });
      } catch (viewError) {
        console.warn(`View "${view}" not found, fetching all records instead`);
        // If view doesn't exist, fetch without view filter
        records = await fetchAllRecords(baseId, 'Subscriptions Corporate', {});
      }
    } else {
      records = await fetchAllRecords(baseId, 'Subscriptions Corporate', {});
    }

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
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    const records = await fetchAllRecords(baseId, 'Subscriptions Corporate', {
      filterByFormula: `FIND("${corporateId}", ARRAYJOIN({Customer}))`,
    });

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
    const baseId = process.env.AIRTABLE_BASE_ID || '';

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

    const records = await updateRecords(baseId, 'Subscriptions Corporate', [
      {
        id,
        fields,
      },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
      },
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
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
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    await deleteRecords(baseId, 'Subscriptions Corporate', [id]);

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
