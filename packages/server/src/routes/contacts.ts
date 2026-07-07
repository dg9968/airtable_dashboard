/**
 * Contacts Routes (Postgres-backed)
 * Manage individual contacts/persons (personal table)
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { personal } from '../db/schema';
import { personalToAirtableRecord, loadPersonalRelationships } from '../db/serializers';

const app = new Hono();

/**
 * GET /api/contacts
 * Get all contacts
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb().select().from(personal);

    const contacts = rows.map((row) => ({
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown',
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      type: undefined, // legacy alias fields (Type / Contact Type) never held data
      status: row.status || 'Active',
    }));

    return c.json({
      success: true,
      data: contacts,
      count: contacts.length
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts',
        suggestion: 'Check the database connection and try again',
        data: []
      },
      500
    );
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDb();

    const [row] = await db.select().from(personal).where(eq(personal.id, id)).limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Contact not found' }, 404);
    }

    const { relMap, lookup } = await loadPersonalRelationships(db, [id]);
    const record = personalToAirtableRecord(row, relMap.get(id), lookup);

    return c.json({
      success: true,
      data: {
        id: row.id,
        name: [row.firstName, row.lastName].filter(Boolean).join(' ') || undefined,
        email: row.email ?? undefined,
        phone: row.phone ?? undefined,
        type: undefined,
        status: row.status ?? undefined,
        fields: record.fields
      }
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Contact not found'
      },
      404
    );
  }
});

export default app;
