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
 * Get all subscription records (optionally filtered by view)
 * Defaults to "Tax Prep Pipeline" view for backward compatibility
 */
app.get('/', async (c) => {
  try {
    const view = c.req.query('view');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    let records;

    // Use provided view, or default to Tax Prep Pipeline for backward compatibility
    const targetView = view || 'Tax Prep Pipeline';

    try {
      records = await fetchAllRecords(baseId, 'Subscriptions Personal', { view: targetView });
    } catch (viewError) {
      console.warn(`View "${targetView}" not found, fetching from Tax Prep Pipeline instead`);
      // Fall back to Tax Prep Pipeline if specified view doesn't exist
      records = await fetchAllRecords(baseId, 'Subscriptions Personal', {
        view: 'Tax Prep Pipeline',
      });
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
 * GET /api/subscriptions-personal/personal/:personalId
 * Get all subscriptions for a specific personal record
 */
app.get('/personal/:personalId', async (c) => {
  try {
    const personalId = c.req.param('personalId');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // First, fetch the personal record to get subscription IDs
    const Airtable = require('airtable');
    const airtable = new Airtable({
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    });
    const base = airtable.base(baseId);

    try {
      const personalRecord = await base('Personal').find(personalId);

      console.log('[DEBUG API] Personal Record ID:', personalId);
      console.log('[DEBUG API] All personal fields:', JSON.stringify(personalRecord.fields, null, 2));

      // Try different possible field names for subscriptions
      const subscriptionIds = personalRecord.fields['Subscriptions Personal'] ||
                              personalRecord.fields['Subscriptions'] ||
                              personalRecord.fields['Personal Subscriptions'] ||
                              [];

      console.log('[DEBUG API] Subscription IDs from Personal record:', subscriptionIds);

      if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        console.log('[DEBUG API] No subscriptions found for this client');
        return c.json({
          success: true,
          data: [],
        });
      }

      // Fetch each subscription record by ID
      console.log('[DEBUG API] Fetching', subscriptionIds.length, 'subscription records...');
      const records = await Promise.all(
        subscriptionIds.map(async (id: string) => {
          try {
            const record = await base('Subscriptions Personal').find(id);
            return record;
          } catch (error) {
            console.error('[DEBUG API] Error fetching subscription record', id, ':', error);
            return null;
          }
        })
      );

      // Filter out any null records (failed fetches)
      const validRecords = records.filter(record => record !== null);

      console.log('[DEBUG API] Successfully fetched', validRecords.length, 'subscription records');
      if (validRecords.length > 0) {
        console.log('[DEBUG API] First record fields:', JSON.stringify(validRecords[0].fields, null, 2));
      }

      return c.json({
        success: true,
        data: validRecords,
      });
    } catch (error) {
      console.error('[API] Error fetching personal or subscriptions:', error);
      console.error('[API] Error details:', error);
      return c.json({
        success: true,
        data: [],
      });
    }
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
