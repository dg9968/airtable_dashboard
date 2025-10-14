/**
 * Services Routes
 */

import { Hono } from 'hono';
import { fetchAllTableData, testConnection } from '../airtable';

const app = new Hono();

/**
 * GET /api/services
 * Fetch all services from Services Corporate table with flexible field detection
 */
app.get('/', async (c) => {
  try {
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return c.json(
        {
          success: false,
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env.local'
        },
        401
      );
    }

    const possibleServiceTableNames = [
      'Services Corporate',
      'Corporate Services',
      'Services',
      'Service Types',
      'Service Categories',
      'Service Offerings'
    ];

    let serviceRecords: any[] = [];
    let actualServiceTableName = '';
    let serviceTableFound = false;

    for (const tableName of possibleServiceTableNames) {
      try {
        console.log(`Trying services table: ${tableName}`);
        serviceRecords = await fetchAllTableData(tableName);
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
      return c.json({
        success: false,
        error: 'No Services Corporate table found',
        suggestion: 'Please check that you have a table for services (e.g., "Services Corporate", "Services", etc.)',
        searchedFor: possibleServiceTableNames
      }, 404);
    }

    const services = serviceRecords.map(record => {
      const possibleNameFields = [
        'Services',
        'Service',
        'Service Name',
        'Name',
        'Service Type',
        'Service Title',
        'Title',
        'Description'
      ];

      let serviceName = 'Unnamed Service';
      let foundField = null;

      for (const fieldName of possibleNameFields) {
        if (record.fields[fieldName] && record.fields[fieldName].toString().trim()) {
          serviceName = record.fields[fieldName].toString().trim();
          foundField = fieldName;
          break;
        }
      }

      if (serviceName === 'Unnamed Service') {
        const textFields = Object.entries(record.fields).filter(([key, value]) =>
          typeof value === 'string' && value.trim().length > 0
        );
        if (textFields.length > 0) {
          serviceName = (textFields[0][1] as string).toString().trim();
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

    const bookkeepingService = services.find(service =>
      service.name === 'Bookkeeping Clients' ||
      service.name.toLowerCase() === 'bookkeeping clients'
    );

    return c.json({
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

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services data',
        suggestion: 'Check your Airtable connection and Services Corporate table'
      },
      500
    );
  }
});

export default app;
