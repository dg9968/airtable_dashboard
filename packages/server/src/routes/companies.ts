/**
 * Companies Routes
 * Manage company/corporate entities
 */

import { Hono } from 'hono';
import Airtable from 'airtable';

const app = new Hono();

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const COMPANIES_TABLE = 'Corporations'; // Using "Corporations" table in Airtable

/**
 * GET /api/companies
 * Get all companies
 */
app.get('/', async (c) => {
  try {
    const companies: any[] = [];

    await base(COMPANIES_TABLE)
      .select({
        view: 'Grid view', // Adjust based on your Airtable view
        maxRecords: 100
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          companies.push({
            id: record.id,
            name: record.fields['Company Name'] || record.fields['Name'] || 'Unknown',
            email: record.fields['Company Email'] || record.fields['Email'],
            phone: record.fields['Company Phone'] || record.fields['Phone'],
            registeredAgent: record.fields['Registered Agent'],
            taxId: record.fields['Tax ID'] || record.fields['EIN'],
            status: record.fields['Status'] || 'Active'
          });
        });
        fetchNextPage();
      });

    return c.json({
      success: true,
      data: companies,
      count: companies.length
    });

  } catch (error) {
    console.error('Error fetching companies:', error);

    // Check if it's a table not found error
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch companies';
    const isNotAuthorized = errorMessage.includes('NOT_AUTHORIZED') || errorMessage.includes('not authorized');

    return c.json(
      {
        success: false,
        error: isNotAuthorized
          ? `The "${COMPANIES_TABLE}" table does not exist in your Airtable base`
          : errorMessage,
        suggestion: isNotAuthorized
          ? `Please create a "${COMPANIES_TABLE}" table in Airtable with fields: Company Name (or Name), Company Email, Company Phone, Registered Agent, Tax ID, Status`
          : 'Check your Airtable configuration and try again',
        setupRequired: isNotAuthorized,
        data: [] // Return empty array so UI doesn't break
      },
      isNotAuthorized ? 200 : 500 // Return 200 with empty data instead of error
    );
  }
});

/**
 * GET /api/companies/:id
 * Get a specific company
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await base(COMPANIES_TABLE).find(id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        name: record.fields['Company Name'] || record.fields['Name'],
        email: record.fields['Company Email'] || record.fields['Email'],
        phone: record.fields['Company Phone'] || record.fields['Phone'],
        registeredAgent: record.fields['Registered Agent'],
        taxId: record.fields['Tax ID'] || record.fields['EIN'],
        status: record.fields['Status'],
        fields: record.fields
      }
    });

  } catch (error) {
    console.error('Error fetching company:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Company not found'
      },
      404
    );
  }
});

export default app;
