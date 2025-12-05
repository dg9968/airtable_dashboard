/**
 * View API Routes
 *
 * Handles fetching Airtable views with various query parameters
 */

import { Hono } from 'hono';
import { testConnection, fetchRecords, findRecord, createRecords, updateRecords } from '../lib/airtable-service';

const app = new Hono();

/**
 * GET /api/view
 * Fetch Airtable view data with optional filtering, sorting, and pagination
 */
app.get('/', async (c) => {
  try {
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

    console.log(`Fetching record ${recordId} from table "${tableName}"`);

    const record = await findRecord(tableName, recordId);

    return c.json({
      success: true,
      data: record
    });

  } catch (error) {
    console.error('Error fetching record:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch record'
      },
      404
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
