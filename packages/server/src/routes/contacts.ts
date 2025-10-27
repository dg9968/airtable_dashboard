/**
 * Contacts Routes
 * Manage individual contacts/persons
 */

import { Hono } from 'hono';
import { fetchRecords, findRecord } from '../lib/airtable-service';

const app = new Hono();

const CONTACTS_TABLE = 'Personal'; // Using "Personal" table in Airtable

/**
 * GET /api/contacts
 * Get all contacts
 */
app.get('/', async (c) => {
  try {
    const records = await fetchRecords(CONTACTS_TABLE, { view: 'Grid view' });

    const contacts = records.map((record, index) => {
      // Log first record to see actual field names
      if (index === 0) {
        console.log('Sample contact record fields:', Object.keys(record.fields));
      }

      return {
        id: record.id,
        name: record.fields['Full Name'] || record.fields['Name'] || 'Unknown',
        email: record.fields['Email'] || record.fields['Personal Email'],
        phone: record.fields['📞Phone number'] || record.fields['Phone'] || record.fields['Personal Phone'],
        type: record.fields['Type'] || record.fields['Contact Type'],
        status: record.fields['Status'] || record.fields['❓Status'] || 'Active'
      };
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
    const record = await findRecord(CONTACTS_TABLE, id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        name: record.fields['Full Name'] || record.fields['Name'],
        email: record.fields['Email'] || record.fields['Personal Email'],
        phone: record.fields['📞Phone number'] || record.fields['Phone'] || record.fields['Personal Phone'],
        type: record.fields['Type'] || record.fields['Contact Type'],
        status: record.fields['Status'] || record.fields['❓Status'],
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
