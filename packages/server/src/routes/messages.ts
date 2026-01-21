/**
 * Messages API Routes
 * Manage email messages for corporate communications
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords } from '../lib/airtable-helpers';

const app = new Hono();

const MESSAGES_TABLE = 'Messages';

/**
 * POST /api/messages
 * Create a new message record
 *
 * Expected body:
 * {
 *   emailSubject: string,
 *   emailContent: string
 * }
 */
app.post('/', async (c) => {
  try {
    const { emailSubject, emailContent } = await c.req.json();

    if (!emailSubject || !emailContent) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: emailSubject and emailContent',
        },
        400
      );
    }

    console.log('Creating Message record:', { emailSubject });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the message record
    const fields: any = {
      'Email Subject': emailSubject,
      'Email Content': emailContent,
    };

    const records = await createRecords(baseId, MESSAGES_TABLE, [
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
    console.error('Error creating Message record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create message',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/messages
 * Get all message records
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, MESSAGES_TABLE, {
      view: 'Grid view',
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
      },
      500
    );
  }
});

/**
 * GET /api/messages/:id
 * Get a single message record by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    const records = await fetchAllRecords(baseId, MESSAGES_TABLE, {
      filterByFormula: `RECORD_ID() = "${id}"`,
    });

    if (records.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Message not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: records[0],
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch message',
      },
      500
    );
  }
});

export default app;
