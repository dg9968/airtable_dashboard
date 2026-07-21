/**
 * Service by Client Routes (Postgres-backed)
 */

import { Hono } from 'hono';
import { getDb } from '../db/client';
import { corporatePipelineTickets } from '../db/schema';
import {
  loadSubsCorporateContext,
  subsCorporateToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

/**
 * GET /api/service-by-client
 * Fetch all corporate subscriptions (legacy Airtable record shape)
 */
app.get('/', async (c) => {
  try {
    const db = getDb();
    const rows = await db.select().from(corporatePipelineTickets);
    const ctx = await loadSubsCorporateContext(db);
    const records = rows.map((row) => subsCorporateToAirtableRecord(row, ctx));

    console.log(`Total records fetched: ${records.length}`);

    const stats = {
      totalRecords: records.length,
      tableName: 'Subscriptions Corporate',
      viewName: 'All Records',
      lastUpdated: new Date().toISOString()
    };

    return c.json({
      success: true,
      data: {
        records,
        stats
      }
    });

  } catch (error) {
    console.error('Error in service by client API route:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch service by client data',
        suggestion: 'Check the database connection and try again'
      },
      500
    );
  }
});

export default app;
