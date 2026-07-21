/**
 * Corporate Pipeline Notes API Routes (Postgres-backed)
 * Message board / conversation system for Corporate Services Pipeline
 */

import { Hono } from 'hono';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporatePipelineNotes, corporatePipelineTickets, corporations } from '../db/schema';
import { noteToAirtableRecord } from '../db/serializers-subscriptions';

const app = new Hono();

type NoteRow = typeof corporatePipelineNotes.$inferSelect;

/** Company Name lookup: note → pipeline ticket → corporation company. */
async function loadCompanyNames(rows: NoteRow[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ticketIds = [...new Set(rows.map((r) => r.subscriptionCorporateId).filter(Boolean))] as string[];
  if (ticketIds.length === 0) return map;
  const tickets = await getDb()
    .select({
      id: corporatePipelineTickets.id,
      company: corporations.company,
    })
    .from(corporatePipelineTickets)
    .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id));
  for (const t of tickets) {
    map.set(t.id, t.company ?? null);
  }
  return map;
}

function serialize(row: NoteRow, companyNames: Map<string, string | null>) {
  return noteToAirtableRecord(row, 'Subscription', row.subscriptionCorporateId, {
    name: 'Company Name',
    value: row.subscriptionCorporateId ? companyNames.get(row.subscriptionCorporateId) ?? null : null,
  });
}

/**
 * POST /api/corporate-pipeline-notes
 * Create a new note/message for a corporate subscription
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

    const [row] = await getDb()
      .insert(corporatePipelineNotes)
      .values({
        subscriptionCorporateId: subscriptionId,
        authorName,
        authorEmail: authorEmail || null,
        note,
      })
      .returning();

    const companyNames = await loadCompanyNames([row]);
    const record = serialize(row, companyNames);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
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
 * Get all notes for a specific corporate subscription
 */
app.get('/subscription/:subscriptionId', async (c) => {
  try {
    const subscriptionId = c.req.param('subscriptionId');

    const rows = await getDb()
      .select()
      .from(corporatePipelineNotes)
      .where(eq(corporatePipelineNotes.subscriptionCorporateId, subscriptionId))
      .orderBy(asc(corporatePipelineNotes.createdAt));

    console.log('[corporate-pipeline-notes] Found', rows.length, 'notes for subscription', subscriptionId);

    const companyNames = await loadCompanyNames(rows);
    return c.json({
      success: true,
      data: rows.map((row) => serialize(row, companyNames)),
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
 * Get all corporate pipeline notes
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(corporatePipelineNotes)
      .orderBy(desc(corporatePipelineNotes.createdAt));

    const companyNames = await loadCompanyNames(rows);
    return c.json({
      success: true,
      data: rows.map((row) => serialize(row, companyNames)),
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
      .update(corporatePipelineNotes)
      .set({ note })
      .where(eq(corporatePipelineNotes.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Note not found' }, 404);
    }

    const companyNames = await loadCompanyNames([row]);
    const record = serialize(row, companyNames);

    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
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

    await getDb().delete(corporatePipelineNotes).where(eq(corporatePipelineNotes.id, id));

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
