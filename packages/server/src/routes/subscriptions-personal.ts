/**
 * Subscriptions Personal API Routes
 *
 * Junction table that links Personal records to Services (Tax Prep Pipeline)
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords, createRecords, updateRecords, deleteRecords } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * POST /api/subscriptions-personal
 * Create a new subscription record linking Personal to Services
 *
 * Expected body:
 * {
 *   personalId: string,  // Airtable record ID from Personal table
 *   serviceId: string    // Airtable record ID from Services table (Tax Prep Pipeline)
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

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the junction record
    // Field names: "Last Name" links to Personal, "Service" links to Personal Services
    const recordData: any = {
      'Last Name': [personalId],  // Link to Personal table
      'Service': [serviceId],      // Link to Personal Services table
    };

    const records = await createRecords(baseId, 'Subscriptions Personal', [
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
 * Get all subscription records from Tax Prep Pipeline view
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, 'Subscriptions Personal', {
      view: 'Tax Prep Pipeline',
    });

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
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    const records = await fetchAllRecords(baseId, 'Subscriptions Personal', {
      filterByFormula: `FIND("${personalId}", ARRAYJOIN({Personal}))`,
    });

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

    console.log('Updating Subscriptions Personal record:', id);
    console.log('Fields to update:', JSON.stringify(fields, null, 2));
    console.log('Base ID:', baseId);

    const records = await updateRecords(baseId, 'Subscriptions Personal', [
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
 * DELETE /api/subscriptions-personal/:id
 * Delete a subscription record
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    await deleteRecords(baseId, 'Subscriptions Personal', [id]);

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
