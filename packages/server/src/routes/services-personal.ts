/**
 * Personal Services Routes
 */

import { Hono } from 'hono';
import { fetchAllTableData, testConnection } from '../airtable';

const app = new Hono();

/**
 * GET /api/services-personal
 * Fetch all services from Personal Services table with flexible field detection
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
      'Personal Services',
      'Services Personal',
      'Services - Personal',
      'Personal Service Types',
    ];

    let serviceRecords: any[] = [];
    let actualServiceTableName = '';
    let serviceTableFound = false;

    for (const tableName of possibleServiceTableNames) {
      try {
        console.log(`Trying personal services table: ${tableName}`);
        serviceRecords = await fetchAllTableData(tableName);
        actualServiceTableName = tableName;
        serviceTableFound = true;
        console.log(`Successfully found personal services table: ${tableName} with ${serviceRecords.length} total records`);
        break;
      } catch (error) {
        console.log(`Personal services table "${tableName}" not found, trying next...`);
        continue;
      }
    }

    if (!serviceTableFound) {
      return c.json({
        success: false,
        error: 'No Personal Services table found',
        suggestion: 'Please check that you have a table for personal services (e.g., "Personal Services", "Services Personal", etc.)',
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

      return {
        id: record.id,
        name: serviceName,
        nameField: foundField,
        allFields: record.fields,
        createdTime: record.createdTime
      };
    });

    console.log(`Returning ${services.length} personal services from ${actualServiceTableName}`);
    console.log(`Service name field used: ${services[0]?.nameField || 'unknown'}`);

    return c.json({
      success: true,
      services: services,
      tableName: actualServiceTableName,
      totalServices: services.length,
      nameField: services[0]?.nameField || null
    });

  } catch (error) {
    console.error('Error in personal services API route:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch personal services',
        suggestion: 'Check your Airtable configuration and ensure the Personal Services table exists'
      },
      500
    );
  }
});

export default app;
