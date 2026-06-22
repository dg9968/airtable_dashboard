import { Hono } from 'hono';
import { fetchAllRecords, createRecords, deleteRecords } from '../lib/airtable-helpers';

const app = new Hono();
const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const NOTES_TABLE = 'Tax Notice Notes';

app.post('/', async (c) => {
  try {
    const { noticeId, authorName, authorEmail, note } = await c.req.json();

    if (!noticeId || !authorName || !note) {
      return c.json(
        { success: false, error: 'Missing required fields: noticeId, authorName, and note' },
        400
      );
    }

    const fields: any = {
      'Tax Notice': [noticeId],
      'Author Name': authorName,
      'Note': note,
    };

    if (authorEmail) fields['Author Email'] = authorEmail;

    const records = await createRecords(BASE_ID, NOTES_TABLE, [{ fields }]);

    return c.json({
      success: true,
      data: { id: records[0].id, fields: records[0].fields },
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

    const allRecords = await fetchAllRecords(BASE_ID, NOTES_TABLE, {
      sort: [{ field: 'Created Time', direction: 'asc' }],
    });

    const records = allRecords.filter((record: any) => {
      const noticeField = record.fields['Tax Notice'];
      return Array.isArray(noticeField) && noticeField.includes(noticeId);
    });

    return c.json({ success: true, data: records });
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
    await deleteRecords(BASE_ID, NOTES_TABLE, [id]);
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
