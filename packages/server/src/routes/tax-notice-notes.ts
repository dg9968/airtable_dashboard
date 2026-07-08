/**
 * Tax Notice Notes API Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { taxNoticeNotes } from '../db/schema';

const app = new Hono();

type NoteRow = typeof taxNoticeNotes.$inferSelect;

// Legacy Airtable record shape
function serialize(row: NoteRow) {
  const fields: Record<string, unknown> = {};
  if (row.taxNoticeId) fields['Tax Notice'] = [row.taxNoticeId];
  if (row.authorName) fields['Author Name'] = row.authorName;
  if (row.authorEmail) fields['Author Email'] = row.authorEmail;
  if (row.note) fields['Note'] = row.note;
  fields['Created Time'] = row.createdAt.toISOString();
  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

app.post('/', async (c) => {
  try {
    const { noticeId, authorName, authorEmail, note } = await c.req.json();

    if (!noticeId || !authorName || !note) {
      return c.json(
        { success: false, error: 'Missing required fields: noticeId, authorName, and note' },
        400
      );
    }

    const [row] = await getDb()
      .insert(taxNoticeNotes)
      .values({
        taxNoticeId: noticeId,
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
    console.error('Error creating Tax Notice Note:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create note' },
      500
    );
  }
});

app.get('/notice/:noticeId', async (c) => {
  try {
    const noticeId = c.req.param('noticeId');

    const rows = await getDb()
      .select()
      .from(taxNoticeNotes)
      .where(eq(taxNoticeNotes.taxNoticeId, noticeId))
      .orderBy(asc(taxNoticeNotes.createdAt));

    return c.json({ success: true, data: rows.map(serialize) });
  } catch (error) {
    console.error('Error fetching Tax Notice Notes:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch notes' },
      500
    );
  }
});

app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await getDb().delete(taxNoticeNotes).where(eq(taxNoticeNotes.id, id));
    return c.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting Tax Notice Note:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete note' },
      500
    );
  }
});

export default app;
