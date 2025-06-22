// app/api/diagnostic/route.ts
import { NextResponse } from 'next/server';
import { fetchAllTableData, testConnection } from '@/lib/airtable';

export async function GET() {
  try {
    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Connection failed: ${connectionTest.message}`
        },
        { status: 401 }
      );
    }

    // Get ALL data from Subscriptions Corporate table
    const records = await fetchAllTableData('Subscriptions Corporate');
    
    // Get the first 3 records and show ALL their fields
    const diagnosticData = records.slice(0, 3).map(record => ({
      id: record.id,
      allFields: record.fields,
      fieldNames: Object.keys(record.fields),
      companyName: record.fields['Company Name'] || record.fields.Name || record.fields.Company || 'No company field'
    }));

    // Also look specifically for any field that might contain services
    const serviceFieldAnalysis = records.slice(0, 5).map(record => {
      const allFieldsWithServices = {};
      Object.keys(record.fields).forEach(fieldName => {
        if (fieldName.toLowerCase().includes('service') || 
            fieldName.toLowerCase().includes('subscription') ||
            fieldName.toLowerCase().includes('corporate')) {
          allFieldsWithServices[fieldName] = record.fields[fieldName];
        }
      });
      
      return {
        id: record.id,
        companyName: record.fields['Company Name'] || record.fields.Name || 'Unknown',
        serviceRelatedFields: allFieldsWithServices
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRecords: records.length,
        tableName: 'Subscriptions Corporate',
        firstThreeRecords: diagnosticData,
        serviceFieldAnalysis: serviceFieldAnalysis,
        allUniqueFieldNames: [...new Set(records.flatMap(r => Object.keys(r.fields)))].sort()
      }
    });

  } catch (error) {
    console.error('Error in diagnostic API route:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch diagnostic data'
      },
      { status: 500 }
    );
  }
}