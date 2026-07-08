/**
 * Billing Notes API Routes (Postgres-backed)
 * Conversation system for Services Rendered / Billing
 */

import { Hono } from 'hono';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { billingNotes } from '../db/schema';
import { noteToAirtableRecord } from '../db/serializers-subscriptions';

const app = new Hono();

type NoteRow = typeof billingNotes.$inferSelect;

function serialize(row: NoteRow) {
  return noteToAirtableRecord(row, 'Services Rendered', row.servicesRenderedId);
}

/**
 * POST /api/billing-notes
 * Create a new note for a service rendered record
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

    const [row] = await getDb()
      .insert(billingNotes)
      .values({
        servicesRenderedId: serviceRenderedId,
        authorName,
        authorEmail: authorEmail || null,
        note,
      })
      .returning();

    const record = serialize(row);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
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
 * Get all notes for a specific services-rendered record
 */
app.get('/service/:serviceId', async (c) => {
  try {
    const serviceId = c.req.param('serviceId');

    const rows = await getDb()
      .select()
      .from(billingNotes)
      .where(eq(billingNotes.servicesRenderedId, serviceId))
      .orderBy(asc(billingNotes.createdAt));

    console.log('[billing-notes] Found', rows.length, 'notes for service', serviceId);

    return c.json({
      success: true,
      data: rows.map(serialize),
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
 * Get all billing notes
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(billingNotes)
      .orderBy(desc(billingNotes.createdAt));

    return c.json({
      success: true,
      data: rows.map(serialize),
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

    if (!note) {
      return c.json(
        {
          success: false,
          error: 'Missing note content',
        },
        400
      );
    }

    const [row] = await getDb()
      .update(billingNotes)
      .set({ note })
      .where(eq(billingNotes.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Note not found' }, 404);
    }

    const record = serialize(row);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
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

    await getDb().delete(billingNotes).where(eq(billingNotes.id, id));

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
