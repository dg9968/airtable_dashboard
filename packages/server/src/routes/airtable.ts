/**
 * Airtable API Routes
 *
 * Handles all Airtable data operations
 */

import { Hono } from 'hono';
import {
  fetchAllTableData,
  getTablesMetadata,
  analyzeTableData,
  testConnection
} from '../airtable';

const app = new Hono();

// Define interfaces
interface TableMetadata {
  id: string;
  name: string;
  fields: any[];
}

/**
 * GET /api/airtable
 * Fetches all tables and their data from Airtable
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
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID'
        },
        401
      );
    }

    // Get all tables metadata
    const tablesMetadata = await getTablesMetadata();

    if (tablesMetadata.length === 0) {
      return c.json(
        {
          success: false,
          error: 'No tables found in the base',
          suggestion: 'Make sure your base has tables and your token has the correct permissions'
        },
        404
      );
    }

    // Fetch data from each table
    const tablesWithData = await Promise.all(
      tablesMetadata.map(async (table: TableMetadata) => {
        try {
          const records = await fetchAllTableData(table.name);
          const analysis = analyzeTableData(records);

          return {
            name: table.name,
            recordCount: analysis.totalRecords,
            fields: analysis.fields,
            fieldTypes: analysis.fieldTypes,
            recentRecords: analysis.recentRecords,
            recentActivity: analysis.recentRecords.length > 0
              ? new Date(analysis.recentRecords[0].createdTime).toLocaleString()
              : 'No recent activity'
          };
        } catch (error) {
          console.error(`Error fetching data for table ${table.name}:`, error);
          return {
            name: table.name,
            recordCount: 0,
            fields: [],
            fieldTypes: {},
            recentRecords: [],
            recentActivity: 'Error loading data',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate statistics
    const stats = {
      totalTables: tablesWithData.length,
      totalRecords: tablesWithData.reduce((sum, table) => sum + table.recordCount, 0),
      totalFields: tablesWithData.reduce((sum, table) => sum + table.fields.length, 0),
      lastUpdated: new Date().toISOString(),
      connectionStatus: 'Connected'
    };

    return c.json({
      success: true,
      data: {
        tables: tablesWithData,
        stats
      }
    });

  } catch (error) {
    console.error('Error in Airtable API:', error);

    let errorMessage = 'Failed to fetch Airtable data';
    let suggestion = 'Please check your configuration and try again';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (errorMessage.includes('AIRTABLE_PERSONAL_ACCESS_TOKEN')) {
        suggestion = 'Create a Personal Access Token at https://airtable.com/create/tokens';
      } else if (errorMessage.includes('AIRTABLE_BASE_ID')) {
        suggestion = 'Check your Base ID in the Airtable URL or API documentation';
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        suggestion
      },
      500
    );
  }
});

/**
 * POST /api/airtable
 * Updates Airtable data
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // TODO: Implement data update logic

    return c.json({
      success: true,
      message: 'Data updated successfully'
    });
  } catch (error) {
    console.error('Error updating Airtable data:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to update data'
      },
      500
    );
  }
});

export default app;
