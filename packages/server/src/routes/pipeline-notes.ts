/**
 * Pipeline Notes API Routes (Postgres-backed)
 * Message board / conversation system for Tax Prep Pipeline
 */

import { Hono } from 'hono';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { pipelineNotes, personalPipelineTickets, personal } from '../db/schema';
import { noteToAirtableRecord } from '../db/serializers-subscriptions';

const app = new Hono();

type NoteRow = typeof pipelineNotes.$inferSelect;

/** Client Name lookup: note → pipeline ticket → personal full name. */
async function loadClientNames(rows: NoteRow[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ticketIds = [...new Set(rows.map((r) => r.subscriptionPersonalId).filter(Boolean))] as string[];
  if (ticketIds.length === 0) return map;
  const db = getDb();
  const tickets = await db
    .select({
      id: personalPipelineTickets.id,
      firstName: personal.firstName,
      lastName: personal.lastName,
    })
    .from(personalPipelineTickets)
    .leftJoin(personal, eq(personalPipelineTickets.personalId, personal.id));
  for (const t of tickets) {
    map.set(t.id, [t.firstName, t.lastName].filter(Boolean).join(' ') || null);
  }
  return map;
}

function serialize(row: NoteRow, clientNames: Map<string, string | null>) {
  return noteToAirtableRecord(row, 'Subscription', row.subscriptionPersonalId, {
    name: 'Client Name',
    value: row.subscriptionPersonalId ? clientNames.get(row.subscriptionPersonalId) ?? null : null,
  });
}

/**
 * POST /api/pipeline-notes
 * Create a new note/message for a subscription
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

    console.log('Creating Pipeline Note:', { subscriptionId, authorName });

    const [row] = await getDb()
      .insert(pipelineNotes)
      .values({
        subscriptionPersonalId: subscriptionId,
        authorName,
        authorEmail: authorEmail || null,
        note,
      })
      .returning();

    const clientNames = await loadClientNames([row]);
    const record = serialize(row, clientNames);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error creating Pipeline Note:', error);
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
 * GET /api/pipeline-notes/subscription/:subscriptionId
 * Get all notes for a specific subscription (ordered by creation time)
 */
app.get('/subscription/:subscriptionId', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');

    const rows = await getDb()
      .select()
      .from(pipelineNotes)
      .where(eq(pipelineNotes.subscriptionPersonalId, subscriptionId))
      .orderBy(asc(pipelineNotes.createdAt));

    console.log('[pipeline-notes] Found', rows.length, 'notes for subscription', subscriptionId);

    const clientNames = await loadClientNames(rows);
    return c.json({
      success: true,
      data: rows.map((row) => serialize(row, clientNames)),
    });
  } catch (error) {
    console.error('Error fetching pipeline notes:', error);
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
 * GET /api/pipeline-notes
 * Get all pipeline notes (useful for admin purposes)
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(pipelineNotes)
      .orderBy(desc(pipelineNotes.createdAt));

    const clientNames = await loadClientNames(rows);
    return c.json({
      success: true,
      data: rows.map((row) => serialize(row, clientNames)),
    });
  } catch (error) {
    console.error('Error fetching pipeline notes:', error);
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
 * PATCH /api/pipeline-notes/:id
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
      .update(pipelineNotes)
      .set({ note })
      .where(eq(pipelineNotes.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Note not found' }, 404);
    }

    const clientNames = await loadClientNames([row]);
    const record = serialize(row, clientNames);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error updating pipeline note:', error);
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
 * DELETE /api/pipeline-notes/:id
 * Delete a note
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    await getDb().delete(pipelineNotes).where(eq(pipelineNotes.id, id));

    return c.json({
      success: true,
      message: 'Note deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting pipeline note:', error);
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
