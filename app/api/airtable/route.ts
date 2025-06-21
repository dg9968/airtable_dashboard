// app/api/airtable/route.ts
import { NextResponse } from 'next/server';
import { fetchAllTableData, getTablesMetadata, analyzeTableData, testConnection } from '@/lib/airtable';

export async function GET() {
  try {
    // First test the connection
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env.local'
        },
        { status: 401 }
      );
    }

    // Get all tables metadata
    const tablesMetadata = await getTablesMetadata();
    
    if (tablesMetadata.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No tables found in the base',
          suggestion: 'Make sure your base has tables and your token has the correct permissions'
        },
        { status: 404 }
      );
    }

    // Fetch data from each table and analyze it
    const tablesWithData = await Promise.all(
      tablesMetadata.map(async (table) => {
        try {
          const records = await fetchAllTableData(table.name); // Use fetchAllTableData for unlimited records
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

    // Calculate overall statistics
    const stats = {
      totalTables: tablesWithData.length,
      totalRecords: tablesWithData.reduce((sum, table) => sum + table.recordCount, 0),
      totalFields: tablesWithData.reduce((sum, table) => sum + table.fields.length, 0),
      lastUpdated: new Date().toISOString(),
      connectionStatus: 'Connected'
    };

    return NextResponse.json({
      success: true,
      data: {
        tables: tablesWithData,
        stats
      }
    });

  } catch (error) {
    console.error('Error in Airtable API route:', error);
    
    let errorMessage = 'Failed to fetch Airtable data';
    let suggestion = 'Please check your configuration and try again';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('AIRTABLE_PERSONAL_ACCESS_TOKEN')) {
        suggestion = 'Create a Personal Access Token at https://airtable.com/create/tokens with data.records:read and schema.bases:read scopes';
      } else if (error.message.includes('AIRTABLE_BASE_ID')) {
        suggestion = 'Check your Base ID in the Airtable URL or API documentation';
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        suggestion
      },
      { status: 500 }
    );
  }
}

// Optional: Add POST method for updating data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Implement data update logic here
    
    return NextResponse.json({
      success: true,
      message: 'Data updated successfully'
    });
  } catch (error) {
    console.error('Error updating Airtable data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update data' 
      },
      { status: 500 }
    );
  }
}