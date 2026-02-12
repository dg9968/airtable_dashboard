/**
 * Corporate Pipeline Notes API Routes
 * Message board / conversation system for Corporate Services Pipeline
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, deleteRecords } from '../lib/airtable-helpers';

const app = new Hono();

const CORPORATE_PIPELINE_NOTES_TABLE = 'Corporate Pipeline Notes';

/**
 * POST /api/corporate-pipeline-notes
 * Create a new note/message for a corporate subscription
 *
 * Expected body:
 * {
 *   subscriptionId: string,  // Airtable record ID from Subscriptions Corporate
 *   authorName: string,      // Name of the person writing the note
 *   authorEmail: string,     // Email of the author
 *   note: string            // The note content
 * }
 */
app.post('/', async (c) => {
  try {
    const { subscriptionId, authorName, authorEmail, note } = await c.req.json();

    if (!subscriptionId || !authorName || !note) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, authorName, and note',
        },
        400
      );
    }

    console.log('Creating Corporate Pipeline Note:', { subscriptionId, authorName });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the note record
    const fields: any = {
      'Subscription': [subscriptionId],
      'Author Name': authorName,
      'Note': note,
    };

    // Only add email if provided
    if (authorEmail) {
      fields['Author Email'] = authorEmail;
    }

    const records = await createRecords(baseId, CORPORATE_PIPELINE_NOTES_TABLE, [
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
    console.error('Error creating Corporate Pipeline Note:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create note',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/corporate-pipeline-notes/subscription/:subscriptionId
 * Get all notes for a specific corporate subscription (ordered by creation time)
 */
app.get('/subscription/:subscriptionId', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    console.log('[corporate-pipeline-notes] Fetching notes for subscription:', subscriptionId);

    // Fetch all records to filter by subscription
    const allRecords = await fetchAllRecords(baseId, CORPORATE_PIPELINE_NOTES_TABLE, {
      sort: [{ field: 'Created Time', direction: 'asc' }],
    });

    console.log('[corporate-pipeline-notes] Total records in table:', allRecords.length);

    // Filter records where the Subscription field contains our subscriptionId
    const records = allRecords.filter((record: any) => {
      const subscriptionField = record.fields['Subscription'];

      // Subscription is an array of record IDs
      if (Array.isArray(subscriptionField)) {
        const matches = subscriptionField.includes(subscriptionId);
        if (matches) {
          console.log('[corporate-pipeline-notes] Found matching record:', record.id);
        }
        return matches;
      }

      return false;
    });

    console.log('[corporate-pipeline-notes] Found', records.length, 'notes for subscription', subscriptionId);

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching corporate pipeline notes:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
      },
      500
    );
  }
});

/**
 * GET /api/corporate-pipeline-notes
 * Get all corporate pipeline notes (useful for admin purposes)
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, CORPORATE_PIPELINE_NOTES_TABLE, {
      sort: [{ field: 'Created Time', direction: 'desc' }],
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching corporate pipeline notes:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notes',
      },
      500
    );
  }
});

/**
 * PATCH /api/corporate-pipeline-notes/:id
 * Update a note (e.g., edit the content)
 */
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { note } = await c.req.json();
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    if (!note) {
      return c.json(
        {
          success: false,
          error: 'Missing note content',
        },
        400
      );
    }

    const records = await updateRecords(baseId, CORPORATE_PIPELINE_NOTES_TABLE, [
      {
        id,
        fields: {
          'Note': note,
        },
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
    console.error('Error updating corporate pipeline note:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update note',
      },
      500
    );
  }
});

/**
 * DELETE /api/corporate-pipeline-notes/:id
 * Delete a note
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    await deleteRecords(baseId, CORPORATE_PIPELINE_NOTES_TABLE, [id]);

    return c.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting corporate pipeline note:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete note',
      },
      500
    );
  }
});

export default app;
