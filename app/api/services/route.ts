// app/api/services/route.ts
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
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env.local'
        },
        { status: 401 }
      );
    }

    // Try to find the Services Corporate table
    const possibleServiceTableNames = [
      'Services Corporate',
      'Corporate Services',
      'Services',
      'Service Types',
      'Service Categories',
      'Service Offerings'
    ];
    
    let serviceRecords;
    let actualServiceTableName = '';
    let serviceTableFound = false;
    
    for (const tableName of possibleServiceTableNames) {
      try {
        console.log(`Trying services table: ${tableName}`);
        serviceRecords = await fetchAllTableData(tableName); // Fetch ALL service records
        actualServiceTableName = tableName;
        serviceTableFound = true;
        console.log(`Successfully found services table: ${tableName} with ${serviceRecords.length} total records`);
        break;
      } catch (error) {
        console.log(`Services table "${tableName}" not found, trying next...`);
        continue;
      }
    }
    
    if (!serviceTableFound) {
      return NextResponse.json({
        success: false,
        error: 'No Services Corporate table found',
        suggestion: 'Please check that you have a table for services (e.g., "Services Corporate", "Services", etc.)',
        searchedFor: possibleServiceTableNames
      }, { status: 404 });
    }

    // Extract service names and analyze the structure
    const services = serviceRecords.map(record => {
      // Try multiple possible field names for the service name
      const possibleNameFields = [
        'Name',
        'Service Name', 
        'Service',
        'Title',
        'Service Type',
        'Service Title',
        'Description'
      ];
      
      let serviceName = 'Unnamed Service';
      let foundField = null;
      
      // Find the first field that has a value
      for (const fieldName of possibleNameFields) {
        if (record.fields[fieldName] && record.fields[fieldName].toString().trim()) {
          serviceName = record.fields[fieldName].toString().trim();
          foundField = fieldName;
          break;
        }
      }
      
      // If still unnamed, try to find any text field
      if (serviceName === 'Unnamed Service') {
        const textFields = Object.entries(record.fields).filter(([key, value]) => 
          typeof value === 'string' && value.trim().length > 0
        );
        if (textFields.length > 0) {
          serviceName = textFields[0][1].toString().trim();
          foundField = textFields[0][0];
        }
      }
      
      return {
        id: record.id,
        name: serviceName,
        nameField: foundField,
        allFields: Object.keys(record.fields),
        allFieldData: record.fields
      };
    });

    // Check if "Bookkeeping Clients" exists
    const bookkeepingService = services.find(service => 
      service.name === 'Bookkeeping Clients' || 
      service.name.toLowerCase() === 'bookkeeping clients'
    );

    return NextResponse.json({
      success: true,
      data: {
        services: services,
        tableName: actualServiceTableName,
        totalServices: services.length,
        bookkeepingServiceExists: !!bookkeepingService,
        bookkeepingService: bookkeepingService || null,
        serviceNames: services.map(s => s.name),
        fieldAnalysis: {
          nameFields: services.map(s => ({ id: s.id, nameField: s.nameField, allFields: s.allFields })),
          allUniqueFields: [...new Set(services.flatMap(s => s.allFields))]
        },
        message: bookkeepingService 
          ? 'Found "Bookkeeping Clients" service in your Services table'
          : 'Could not find "Bookkeeping Clients" service in your Services table'
      }
    });

  } catch (error) {
    console.error('Error in services API route:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch services data',
        suggestion: 'Check your Airtable connection and Services Corporate table'
      },
      { status: 500 }
    );
  }
}