/**
 * Contacts Routes
 * Manage individual contacts/persons
 */

import { Hono } from 'hono';
import Airtable from 'airtable';

const app = new Hono();

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const CONTACTS_TABLE = 'Personal'; // Using "Personal" table in Airtable

/**
 * GET /api/contacts
 * Get all contacts
 */
app.get('/', async (c) => {
  try {
    const contacts: any[] = [];

    await base(CONTACTS_TABLE)
      .select({
        view: 'Grid view', // Adjust based on your Airtable view
        maxRecords: 100
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          contacts.push({
            id: record.id,
            name: record.fields['Name'] || record.fields['Full Name'] || 'Unknown',
            email: record.fields['Email'] || record.fields['Personal Email'],
            phone: record.fields['Phone'] || record.fields['Personal Phone'],
            type: record.fields['Type'] || record.fields['Contact Type'],
            status: record.fields['Status'] || 'Active'
          });
        });
        fetchNextPage();
      });

    return c.json({
      success: true,
      data: contacts,
      count: contacts.length
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);

    // Check if it's a table not found error
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch contacts';
    const isNotAuthorized = errorMessage.includes('NOT_AUTHORIZED') || errorMessage.includes('not authorized');

    return c.json(
      {
        success: false,
        error: isNotAuthorized
          ? `The "${CONTACTS_TABLE}" table does not exist in your Airtable base`
          : errorMessage,
        suggestion: isNotAuthorized
          ? `Please create a "${CONTACTS_TABLE}" table in Airtable with fields: Name, Email, Phone, Type, Status`
          : 'Check your Airtable configuration and try again',
        setupRequired: isNotAuthorized,
        data: [] // Return empty array so UI doesn't break
      },
      isNotAuthorized ? 200 : 500 // Return 200 with empty data instead of error
    );
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await base(CONTACTS_TABLE).find(id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        name: record.fields['Name'] || record.fields['Full Name'],
        email: record.fields['Email'] || record.fields['Personal Email'],
        phone: record.fields['Phone'] || record.fields['Personal Phone'],
        type: record.fields['Type'] || record.fields['Contact Type'],
        status: record.fields['Status'],
        fields: record.fields
      }
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Contact not found'
      },
      404
    );
  }
});

export default app;
