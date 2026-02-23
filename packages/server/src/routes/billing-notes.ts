/**
 * Billing Notes API Routes
 * Conversation system for Services Rendered / Billing
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, deleteRecords } from '../lib/airtable-helpers';

const app = new Hono();

const BILLING_NOTES_TABLE = 'Billing Notes';

/**
 * POST /api/billing-notes
 * Create a new note for a service rendered record
 *
 * Expected body:
 * {
 *   serviceRenderedId: string,  // Airtable record ID from Services Rendered
 *   authorName: string,         // Name of the person writing the note
 *   authorEmail?: string,       // Email of the author (optional)
 *   note: string               // The note content
 * }
 */
app.post('/', async (c) => {
  try {
    const { serviceRenderedId, authorName, authorEmail, note } = await c.req.json();

    if (!serviceRenderedId || !authorName || !note) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: serviceRenderedId, authorName, and note',
        },
        400
      );
    }

    console.log('Creating Billing Note:', { serviceRenderedId, authorName });

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Create the note record
    const fields: any = {
      'Services Rendered': [serviceRenderedId],
      'Author Name': authorName,
      'Note': note,
    };

    // Only add email if provided
    if (authorEmail) {
      fields['Author Email'] = authorEmail;
    }

    const records = await createRecords(baseId, BILLING_NOTES_TABLE, [
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
    console.error('Error creating Billing Note:', error);
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
 * GET /api/billing-notes/service/:serviceId
 * Get all notes for a specific service rendered record (ordered by creation time)
 */
app.get('/service/:serviceId', async (c) => {
  try {
    const serviceId = c.req.param('serviceId');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    console.log('[billing-notes] Fetching notes for service:', serviceId);

    // Fetch all records
    const allRecords = await fetchAllRecords(baseId, BILLING_NOTES_TABLE, {
      sort: [{ field: 'Created Time', direction: 'asc' }],
    });

    console.log('[billing-notes] Total records in table:', allRecords.length);

    // Filter records where the Services Rendered field contains our serviceId
    const records = allRecords.filter((record: any) => {
      const serviceField = record.fields['Services Rendered'];

      // Services Rendered is an array of record IDs
      if (Array.isArray(serviceField)) {
        return serviceField.includes(serviceId);
      }

      return false;
    });

    console.log('[billing-notes] Found', records.length, 'notes for service', serviceId);

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching billing notes:', error);
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
 * GET /api/billing-notes
 * Get all billing notes (useful for admin purposes)
 */
app.get('/', async (c) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID || '';
    const records = await fetchAllRecords(baseId, BILLING_NOTES_TABLE, {
      sort: [{ field: 'Created Time', direction: 'desc' }],
    });

    return c.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching billing notes:', error);
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
 * PATCH /api/billing-notes/:id
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

    const records = await updateRecords(baseId, BILLING_NOTES_TABLE, [
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
    console.error('Error updating billing note:', error);
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
 * DELETE /api/billing-notes/:id
 * Delete a note
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const baseId = process.env.AIRTABLE_BASE_ID || '';

    await deleteRecords(baseId, BILLING_NOTES_TABLE, [id]);

    return c.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting billing note:', error);
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
