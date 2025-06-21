// app/api/tables/route.ts
import { NextResponse } from 'next/server';
import { getTablesMetadata, testConnection } from '@/lib/airtable';

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

    // Get all tables in the base
    const tables = await getTablesMetadata();
    
    return NextResponse.json({
      success: true,
      data: {
        tables: tables.map(table => ({
          id: table.id,
          name: table.name,
          fieldCount: table.fields ? table.fields.length : 0
        })),
        totalTables: tables.length,
        message: 'These are all the tables available in your Airtable base'
      }
    });

  } catch (error) {
    console.error('Error in tables API route:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch tables',
        suggestion: 'Check your Airtable connection and permissions'
      },
      { status: 500 }
    );
  }
}