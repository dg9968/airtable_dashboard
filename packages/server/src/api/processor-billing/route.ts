// app/api/processor-billing/route.ts
import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/airtable';
import Airtable from 'airtable';

// Initialize Airtable
const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');

export async function GET() {
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

    const tableName = 'Subscriptions Corporate';
    const viewName = 'Bookkeeping Billing';

    console.log(`Fetching view "${viewName}" from table "${tableName}"`);

    const records: any[] = [];
    
    // Fetch records from the Bookkeeping Billing view
    await base(tableName)
      .select({
        view: viewName
      })
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

    // Basic statistics
    const stats = {
      totalRecords: records.length,
      tableName,
      viewName,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: {
        records,
        stats
      }
    });

  } catch (error) {
    console.error('Error in processor billing API route:', error);
    
    let errorMessage = 'Failed to fetch processor billing data';
    let suggestion = 'Please check your configuration and try again';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('Table') && error.message.includes('not found')) {
        suggestion = 'Please check that the "Subscriptions Corporate" table exists in your Airtable base';
      } else if (error.message.includes('View') && error.message.includes('not found')) {
        suggestion = 'Please check that the "Bookkeeping Billing" view exists in your Subscriptions Corporate table';
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