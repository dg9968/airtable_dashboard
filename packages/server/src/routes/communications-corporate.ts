/**
 * Communications Corporate API Routes
 * Junction table that links Message records to Corporations (Corporate clients)
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords } from '../lib/airtable-helpers';

const app = new Hono();

const COMMUNICATIONS_CORPORATE_TABLE = 'Communications Corporate';

/**
 * POST /api/communications-corporate
 * Create a new junction record linking Message to Corporations
 *
 * Expected body:
 * {
 *   messageId: string,       // Airtable record ID from Message table
 *   corporateId: string,     // Airtable record ID from Corporations table
 *   description?: string     // Optional description
 * }
 */
app.post('/', async (c) => {
  try {
    const { messageId, corporateId, description } = await c.req.json();

    if (!messageId || !corporateId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: messageId and corporateId',
        },
        400
      );
    }

    console.log('Creating Communications Corporate junction record:', { messageId, corporateId });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the junction record
    // Field names must match Airtable exactly
    const fields: any = {
      'Message': [messageId],      // Link to Message table (array format)
      'Corporate': [corporateId],  // Link to Corporations table (array format)
    };

    // Add optional description if provided
    if (description) {
      fields['Description'] = description;
    }

    const records = await createRecords(baseId, COMMUNICATIONS_CORPORATE_TABLE, [
      { fields },
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields,
      },
    });
  } catch (error) {
    console.error('Error creating Communications Corporate record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create communications record',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/communications-corporate
 * Get all communications records
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, COMMUNICATIONS_CORPORATE_TABLE, {
      view: 'Grid view',
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching communications:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch communications',
      },
      500
    );
  }
});

/**
 * GET /api/communications-corporate/corporate/:corporateId
 * Get all communications for a specific corporate client
 */
app.get('/corporate/:corporateId', async (c) => {
  try {
    const corporateId = c.req.param('corporateId');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    const records = await fetchAllRecords(baseId, COMMUNICATIONS_CORPORATE_TABLE, {
      filterByFormula: `FIND("${corporateId}", ARRAYJOIN({Corporate}))`,
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching corporate communications:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch communications',
      },
      500
    );
  }
});

export default app;
