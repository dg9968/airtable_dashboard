/**
 * View API Routes
 *
 * Handles fetching Airtable views with various query parameters
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { testConnection, fetchRecords, findRecord, createRecords, updateRecords } from '../lib/airtable-service';
import { getDb } from '../db/client';
import { personal, corporations } from '../db/schema';
import {
  personalToAirtableRecord,
  corporationToAirtableRecord,
  personalFieldsToColumns,
  corporationFieldsToColumns,
  loadPersonalRelationships,
  computeClientCode,
  type AirtableShapedRecord,
} from '../db/serializers';

const app = new Hono();

// Tables already migrated to Postgres — served from the DB in the legacy
// Airtable record shape. Everything else still proxies to Airtable.
const MIGRATED_TABLES = new Set(['Personal', 'Corporations']);

async function fetchMigratedRecords(tableName: string): Promise<AirtableShapedRecord[]> {
  const db = getDb();
  if (tableName === 'Personal') {
    const rows = await db.select().from(personal);
    const { relMap, lookup } = await loadPersonalRelationships(db);
    return rows.map((row) => personalToAirtableRecord(row, relMap.get(row.id), lookup));
  }
  const rows = await db.select().from(corporations);
  return rows.map(corporationToAirtableRecord);
}

/**
 * GET /api/view
 * Fetch Airtable view data with optional filtering, sorting, and pagination
 */
app.get('/', async (c) => {
  try {
    // Migrated tables: serve from Postgres, keeping the legacy response shape.
    // View/sort/filter params are ignored for these (clients of Personal/
    // Corporations only use table + view=Grid view).
    const requestedTable = c.req.query('table') || 'Subscriptions Corporate';
    if (MIGRATED_TABLES.has(requestedTable)) {
      const records = await fetchMigratedRecords(requestedTable);
      const fieldNames = records.length > 0 ? Object.keys(records[0].fields) : [];
      const recentRecords = [...records]
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
        .slice(0, 5);
      return c.json({
        success: true,
        data: {
          records,
          stats: {
            totalRecords: records.length,
            fieldCount: fieldNames.length,
            tableName: requestedTable,
            viewName: c.req.query('view') || 'Grid view',
            lastUpdated: new Date().toISOString(),
            recentActivity:
              recentRecords.length > 0
                ? new Date(recentRecords[0].createdTime).toLocaleString()
                : 'No recent activity',
          },
          fieldNames,
          fieldTypes: {},
          recentRecords,
          queryParams: {
            tableName: requestedTable,
            viewName: c.req.query('view') || 'Grid view',
          },
        },
      });
    }

    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env',
        },
        401
      );
    }

    // Get query parameters
    const tableName = c.req.query('table') || 'Subscriptions Corporate';
    const viewName = c.req.query('view') || 'Grid view';
    const maxRecordsParam = c.req.query('maxRecords');
    const maxRecords = maxRecordsParam ? parseInt(maxRecordsParam) : undefined;
    const sortField = c.req.query('sortField');
    const sortDirection = (c.req.query('sortDirection') as 'asc' | 'desc') || 'asc';
    const filterByFormula = c.req.query('filterByFormula');

    console.log(`Fetching view "${viewName}" from table "${tableName}"`);

    // Build select options
    const selectOptions: any = {
      view: viewName,
    };

    if (maxRecords && maxRecords > 0) {
      selectOptions.maxRecords = maxRecords;
    }

    if (sortField) {
      selectOptions.sort = [
        {
          field: sortField,
          direction: sortDirection,
        },
      ];
    }

    if (filterByFormula) {
      selectOptions.filterByFormula = filterByFormula;
    }

    // Fetch records from the specified view
    const records = await fetchRecords(tableName, selectOptions);

    console.log(`Total records fetched: ${records.length}`);

    // Analyze the data structure
    const fieldNames = records.length > 0 ? Object.keys(records[0].fields) : [];
    const fieldTypes: Record<string, string> = {};

    if (records.length > 0) {
      fieldNames.forEach((field) => {
        const sampleValue = records[0].fields[field];
        if (Array.isArray(sampleValue)) {
          fieldTypes[field] = 'array';
        } else if (sampleValue instanceof Date) {
          fieldTypes[field] = 'date';
        } else if (typeof sampleValue === 'number') {
          fieldTypes[field] = 'number';
        } else if (typeof sampleValue === 'boolean') {
          fieldTypes[field] = 'boolean';
        } else if (sampleValue && typeof sampleValue === 'object') {
          fieldTypes[field] = 'object';
        } else {
          fieldTypes[field] = 'text';
        }
      });
    }

    // Get recent records (last 5)
    const recentRecords = records
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .slice(0, 5);

    // Calculate basic statistics
    const stats = {
      totalRecords: records.length,
      fieldCount: fieldNames.length,
      tableName,
      viewName,
      lastUpdated: new Date().toISOString(),
      recentActivity:
        recentRecords.length > 0
          ? new Date(recentRecords[0].createdTime).toLocaleString()
          : 'No recent activity',
    };

    return c.json({
      success: true,
      data: {
        records,
        stats,
        fieldNames,
        fieldTypes,
        recentRecords,
        queryParams: {
          tableName,
          viewName,
          maxRecords,
          sortField,
          sortDirection,
          filterByFormula,
        },
      },
    });
  } catch (error) {
    console.error('Error in view API route:', error);

    let errorMessage = 'Failed to fetch view data';
    let suggestion = 'Please check your configuration and try again';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('Table') && error.message.includes('not found')) {
        suggestion = 'Please check that the table name exists in your Airtable base';
      } else if (error.message.includes('View') && error.message.includes('not found')) {
        suggestion = 'Please check that the view name exists in your specified table';
      } else if (error.message.includes('AIRTABLE_PERSONAL_ACCESS_TOKEN')) {
        suggestion = 'Create a Personal Access Token at https://airtable.com/create/tokens with data.records:read scope';
      } else if (error.message.includes('AIRTABLE_BASE_ID')) {
        suggestion = 'Check your Base ID in the Airtable URL or API documentation';
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        suggestion,
      },
      500
    );
  }
});

/**
 * GET /api/view/:tableName/:recordId
 * Get a specific record by ID from a table
 */
app.get('/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const recordId = c.req.param('recordId');

    console.log(`[View API] Fetching record ${recordId} from table "${tableName}"`);

    if (MIGRATED_TABLES.has(tableName)) {
      const db = getDb();
      if (tableName === 'Personal') {
        const [row] = await db.select().from(personal).where(eq(personal.id, recordId)).limit(1);
        if (!row) {
          return c.json({ success: false, error: 'Record not found', table: tableName, recordId }, 404);
        }
        const { relMap, lookup } = await loadPersonalRelationships(db, [recordId]);
        return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(recordId), lookup) });
      }
      const [row] = await db.select().from(corporations).where(eq(corporations.id, recordId)).limit(1);
      if (!row) {
        return c.json({ success: false, error: 'Record not found', table: tableName, recordId }, 404);
      }
      return c.json({ success: true, data: corporationToAirtableRecord(row) });
    }

    const record = await findRecord(tableName, recordId);

    console.log(`[View API] Successfully fetched record ${recordId}`);

    return c.json({
      success: true,
      data: record
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch record';
    console.error(`[View API] Error fetching record ${c.req.param('recordId')} from table "${c.req.param('tableName')}":`, errorMessage);

    // Check if it's a "not found" error vs other errors
    const isNotFound = errorMessage.includes('NOT_FOUND') || errorMessage.includes('Could not find');

    return c.json(
      {
        success: false,
        error: errorMessage,
        table: c.req.param('tableName'),
        recordId: c.req.param('recordId')
      },
      isNotFound ? 404 : 500
    );
  }
});

/**
 * POST /api/view/:tableName
 * Create a new record in the specified table
 */
app.post('/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json(
        { success: false, error: 'Missing required field: fields' },
        400
      );
    }

    console.log(`Creating record in table "${tableName}"`, fields);

    if (MIGRATED_TABLES.has(tableName)) {
      const db = getDb();
      if (tableName === 'Personal') {
        const values = personalFieldsToColumns(fields);
        values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ssn ?? null);
        const [row] = await db.insert(personal).values(values).returning();
        const { relMap, lookup } = await loadPersonalRelationships(db, [row.id]);
        return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(row.id), lookup) }, 201);
      }
      const values = corporationFieldsToColumns(fields);
      values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ein ?? null);
      const [row] = await db.insert(corporations).values(values).returning();
      return c.json({ success: true, data: corporationToAirtableRecord(row) }, 201);
    }

    const records = await createRecords(tableName, [{ fields }]);

    return c.json({
      success: true,
      data: records[0]
    }, 201);

  } catch (error) {
    console.error('Error creating record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create record'
      },
      500
    );
  }
});

/**
 * PATCH /api/view/:tableName/:recordId
 * Update a record in the specified table
 */
app.patch('/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const recordId = c.req.param('recordId');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json(
        { success: false, error: 'Missing required field: fields' },
        400
      );
    }

    console.log(`Updating record ${recordId} in table "${tableName}"`, fields);

    if (MIGRATED_TABLES.has(tableName)) {
      const db = getDb();
      if (tableName === 'Personal') {
        const values = personalFieldsToColumns(fields);
        const [existing] = await db.select().from(personal).where(eq(personal.id, recordId)).limit(1);
        if (!existing) {
          return c.json({ success: false, error: 'Record not found' }, 404);
        }
        values.clientCode = computeClientCode(
          (values.clientCodeOverride ?? existing.clientCodeOverride) || null,
          (values.ssn ?? existing.ssn) || null
        );
        const [row] = await db.update(personal).set(values).where(eq(personal.id, recordId)).returning();
        const { relMap, lookup } = await loadPersonalRelationships(db, [recordId]);
        return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(recordId), lookup) });
      }
      const values = corporationFieldsToColumns(fields);
      const [existing] = await db.select().from(corporations).where(eq(corporations.id, recordId)).limit(1);
      if (!existing) {
        return c.json({ success: false, error: 'Record not found' }, 404);
      }
      values.clientCode = computeClientCode(
        (values.clientCodeOverride ?? existing.clientCodeOverride) || null,
        (values.ein ?? existing.ein) || null
      );
      const [row] = await db.update(corporations).set(values).where(eq(corporations.id, recordId)).returning();
      return c.json({ success: true, data: corporationToAirtableRecord(row) });
    }

    const records = await updateRecords(tableName, [{ id: recordId, fields }]);

    return c.json({
      success: true,
      data: records[0]
    });

  } catch (error) {
    console.error('Error updating record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update record'
      },
      500
    );
  }
});

export default app;
