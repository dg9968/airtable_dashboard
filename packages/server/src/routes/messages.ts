/**
 * Messages API Routes (Postgres-backed)
 * Manage email messages for corporate communications
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { messages } from '../db/schema';

const app = new Hono();

type MessageRow = typeof messages.$inferSelect;

// Legacy Airtable record shape
function serialize(row: MessageRow) {
  const fields: Record<string, unknown> = {};
  if (row.emailSubject) fields['Email Subject'] = row.emailSubject;
  if (row.emailContent) fields['Email Content'] = row.emailContent;
  if (row.batchId) fields['Batch ID'] = row.batchId;
  if (row.templateUsedId) fields['Template Used'] = [row.templateUsedId];
  if (row.variablesUsed) fields['Variables Used'] = row.variablesUsed;
  if (row.isBatchMessage) fields['Is Batch Message'] = true;
  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

/**
 * POST /api/messages
 * Create a new message record
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

    const [row] = await getDb()
      .insert(messages)
      .values({ emailSubject, emailContent })
      .returning();

    const record = serialize(row);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
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
    const rows = await getDb().select().from(messages);

    return c.json({
      success: true,
      data: rows.map(serialize),
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

    const [row] = await getDb().select().from(messages).where(eq(messages.id, id)).limit(1);

    if (!row) {
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
      data: serialize(row),
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
