/**
 * Communications Corporate API Routes (Postgres-backed)
 * Junction table that links Message records to Corporations (Corporate clients)
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { communicationsCorporate } from '../db/schema';

const app = new Hono();

type CommRow = typeof communicationsCorporate.$inferSelect;

// Legacy Airtable record shape. 'Email Subject' / 'Company_Contacts (from
// Corporate)' / 'To Email' were Airtable formula/lookup fields — not stored,
// and unused by the client (grep-confirmed), so intentionally omitted.
function serialize(row: CommRow) {
  const fields: Record<string, unknown> = {};
  if (row.messageId) fields['Message'] = [row.messageId];
  if (row.corporationId) fields['Corporate'] = [row.corporationId];
  if (row.status) fields['Status'] = row.status;
  if (row.description) fields['Description'] = row.description;
  if (row.batchId) fields['Batch ID'] = row.batchId;
  if (row.personalizedSubject) fields['Personalized Subject'] = row.personalizedSubject;
  if (row.personalizedContent) fields['Personalized Content'] = row.personalizedContent;
  if (row.variableValues) fields['Variable Values'] = row.variableValues;
  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

/**
 * POST /api/communications-corporate
 * Create a new junction record linking Message to Corporations
 */
app.post('/', async (c) => {
  try {
    const { messageId, corporateId, description } = await c.req.json();

    if (!messageId || !corporateId) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: messageId and corporateId',
        },
        400
      );
    }

    console.log('Creating Communications Corporate junction record:', { messageId, corporateId });

    const [row] = await getDb()
      .insert(communicationsCorporate)
      .values({
        messageId,
        corporationId: corporateId,
        description: description || null,
      })
      .returning();

    const record = serialize(row);
    return c.json({
      success: true,
      data: { id: record.id, fields: record.fields },
    });
  } catch (error) {
    console.error('Error creating Communications Corporate record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create communications record',
        details: error instanceof Error ? error.stack : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/communications-corporate
 * Get all communications records
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb().select().from(communicationsCorporate);

    return c.json({
      success: true,
      data: rows.map(serialize),
    });
  } catch (error) {
    console.error('Error fetching communications:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch communications',
      },
      500
    );
  }
});

/**
 * GET /api/communications-corporate/corporate/:corporateId
 * Get all communications for a specific corporate client
 */
app.get('/corporate/:corporateId', async (c) => {
  try {
    const corporateId = c.req.param('corporateId');

    const rows = await getDb()
      .select()
      .from(communicationsCorporate)
      .where(eq(communicationsCorporate.corporationId, corporateId));

    return c.json({
      success: true,
      data: rows.map(serialize),
    });
  } catch (error) {
    console.error('Error fetching corporate communications:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch communications',
      },
      500
    );
  }
});

export default app;
