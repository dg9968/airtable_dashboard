/**
 * Teams API Routes
 *
 * Fetch tax preparers from the Teams table
 */

import { Hono } from 'hono';
import { testConnection } from '../airtable';
import { fetchAllRecords } from '../lib/airtable-helpers';

const app = new Hono();

/**
 * GET /api/teams
 * Get all tax preparers from the Teams table
 */
app.get('/', async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
        },
        401
      );
    }

    const baseId = process.env.AIRTABLE_BASE_ID || '';

    // Try different possible table names - prioritize Team/Teams tables over Users
    const possibleTableNames = ['Team', 'Teams', 'team', 'teams', 'Users'];
    let records = [];
    let tableName = '';

    for (const name of possibleTableNames) {
      try {
        console.log(`Trying table name: ${name}`);
        records = await fetchAllRecords(baseId, name);
        tableName = name;
        console.log(`Successfully fetched from table: ${name} (${records.length} records)`);
        break;
      } catch (err) {
        console.log(`Failed to fetch from table: ${name}`);
        continue;
      }
    }

    if (records.length === 0 && !tableName) {
      throw new Error('Could not find Team/Teams table. Please check the table name in Airtable.');
    }

    // Map to a simpler format
    const teams = records.map((record: any) => ({
      id: record.id,
      name: record.fields.Name || record.fields.Extension || '',
      email: record.fields.Email || '',
    }));

    return c.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
      },
      500
    );
  }
});

export default app;
