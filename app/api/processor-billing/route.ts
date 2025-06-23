// app/api/view/route.ts
import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/airtable';
import Airtable from 'airtable';

// Initialize Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

export async function GET(request: Request) {
  try {
    // Test connection first
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table') || 'Subscriptions Corporate';
    const viewName = searchParams.get('view') || 'Bookkeeping Billing';
    const maxRecords = searchParams.get('maxRecords') ? parseInt(searchParams.get('maxRecords')!) : undefined;
    const sortField = searchParams.get('sortField');
    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc' || 'asc';
    const filterByFormula = searchParams.get('filterByFormula');

    console.log(`Fetching view "${viewName}" from table "${tableName}"`);

    const records: any[] = [];
    
    // Build select options
    const selectOptions: any = {
      view: viewName
    };
    
    if (maxRecords && maxRecords > 0) {
      selectOptions.maxRecords = maxRecords;
    }
    
    if (sortField) {
      selectOptions.sort = [{
        field: sortField,
        direction: sortDirection
      }];
    }
    
    if (filterByFormula) {
      selectOptions.filterByFormula = filterByFormula;
    }

    // Fetch records from the specified view
    await base(tableName)
      .select(selectOptions)
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            fields: record.fields,
            createdTime: record._rawJson.createdTime
          });
        });
        
        if (records.length % 100 === 0) {
          console.log(`Fetched ${records.length} records so far...`);
        }
        
        fetchNextPage();
      });

    console.log(`Total records fetched: ${records.length}`);

    // Analyze the data structure
    const fieldNames = records.length > 0 ? Object.keys(records[0].fields) : [];
    const fieldTypes: Record<string, string> = {};
    
    if (records.length > 0) {
      fieldNames.forEach(field => {
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
      recentActivity: recentRecords.length > 0 
        ? new Date(recentRecords[0].createdTime).toLocaleString()
        : 'No recent activity'
    };

    return NextResponse.json({
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
          filterByFormula
        }
      }
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