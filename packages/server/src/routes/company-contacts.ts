/**
 * Company_Contacts Junction Table Routes
 * Manages the many-to-many relationship between Contacts and Companies
 */

import { Hono } from 'hono';
import Airtable from 'airtable';

const app = new Hono();

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const COMPANY_CONTACTS_TABLE = 'Company_Contacts';
const CONTACTS_TABLE = 'Contacts';
const COMPANIES_TABLE = 'Companies';

interface CompanyContactRelationship {
  id?: string;
  contactId: string;
  companyId: string;
  role?: string;
  isPrimary?: boolean;
  workEmail?: string;
  workPhone?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  status?: 'Active' | 'Inactive';
}

/**
 * GET /api/company-contacts
 * Get all company-contact relationships (with optional filters)
 */
app.get('/', async (c) => {
  try {
    const contactId = c.req.query('contactId');
    const companyId = c.req.query('companyId');
    const status = c.req.query('status') || 'Active';

    let filterFormula = '';

    if (contactId && companyId) {
      filterFormula = `AND({Contact ID}='${contactId}', {Company ID}='${companyId}', {Status}='${status}')`;
    } else if (contactId) {
      filterFormula = `AND({Contact ID}='${contactId}', {Status}='${status}')`;
    } else if (companyId) {
      filterFormula = `AND({Company ID}='${companyId}', {Status}='${status}')`;
    } else {
      filterFormula = `{Status}='${status}'`;
    }

    const relationships: any[] = [];

    await base(COMPANY_CONTACTS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Start Date', direction: 'desc' }]
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          relationships.push({
            id: record.id,
            contactId: record.fields['Contact ID'],
            companyId: record.fields['Company ID'],
            contactName: record.fields['Contact Name'],
            companyName: record.fields['Company Name'],
            role: record.fields['Role'],
            isPrimary: record.fields['Is Primary Contact'] || false,
            workEmail: record.fields['Work Email'],
            workPhone: record.fields['Work Phone'],
            department: record.fields['Department'],
            startDate: record.fields['Start Date'],
            endDate: record.fields['End Date'],
            status: record.fields['Status'] || 'Active',
            createdTime: record._rawJson.createdTime
          });
        });
        fetchNextPage();
      });

    return c.json({
      success: true,
      data: relationships,
      count: relationships.length
    });

  } catch (error) {
    console.error('Error fetching company-contact relationships:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch relationships'
      },
      500
    );
  }
});

/**
 * GET /api/company-contacts/:id
 * Get a specific relationship by ID
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const record = await base(COMPANY_CONTACTS_TABLE).find(id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        contactId: record.fields['Contact ID'],
        companyId: record.fields['Company ID'],
        contactName: record.fields['Contact Name'],
        companyName: record.fields['Company Name'],
        role: record.fields['Role'],
        isPrimary: record.fields['Is Primary Contact'] || false,
        workEmail: record.fields['Work Email'],
        workPhone: record.fields['Work Phone'],
        department: record.fields['Department'],
        startDate: record.fields['Start Date'],
        endDate: record.fields['End Date'],
        status: record.fields['Status'] || 'Active',
        createdTime: record._rawJson.createdTime
      }
    });

  } catch (error) {
    console.error('Error fetching relationship:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Relationship not found'
      },
      404
    );
  }
});

/**
 * POST /api/company-contacts
 * Create a new company-contact relationship
 */
app.post('/', async (c) => {
  try {
    const data: CompanyContactRelationship = await c.req.json();

    if (!data.contactId || !data.companyId) {
      return c.json(
        { success: false, error: 'Contact ID and Company ID are required' },
        400
      );
    }

    // Check if relationship already exists
    const existing = await base(COMPANY_CONTACTS_TABLE)
      .select({
        filterByFormula: `AND({Contact ID}='${data.contactId}', {Company ID}='${data.companyId}', {Status}='Active')`,
        maxRecords: 1
      })
      .firstPage();

    if (existing.length > 0) {
      return c.json(
        { success: false, error: 'Active relationship already exists between this contact and company' },
        409
      );
    }

    const recordData: any = {
      'Contact': [data.contactId], // Linked record field
      'Company': [data.companyId], // Linked record field
      'Status': data.status || 'Active',
      'Start Date': data.startDate || new Date().toISOString().split('T')[0]
    };

    if (data.role) recordData['Role'] = data.role;
    if (data.isPrimary !== undefined) recordData['Is Primary Contact'] = data.isPrimary;
    if (data.workEmail) recordData['Work Email'] = data.workEmail;
    if (data.workPhone) recordData['Work Phone'] = data.workPhone;
    if (data.department) recordData['Department'] = data.department;

    console.log('Creating company-contact relationship:', recordData);

    const record = await base(COMPANY_CONTACTS_TABLE).create([
      { fields: recordData }
    ]);

    return c.json({
      success: true,
      data: {
        id: record[0].id,
        fields: record[0].fields
      }
    }, 201);

  } catch (error) {
    console.error('Error creating relationship:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create relationship',
        details: error instanceof Error ? error.stack : undefined
      },
      500
    );
  }
});

/**
 * PATCH /api/company-contacts/:id
 * Update a company-contact relationship
 */
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data: Partial<CompanyContactRelationship> = await c.req.json();

    const updateFields: any = {};

    if (data.role !== undefined) updateFields['Role'] = data.role;
    if (data.isPrimary !== undefined) updateFields['Is Primary Contact'] = data.isPrimary;
    if (data.workEmail !== undefined) updateFields['Work Email'] = data.workEmail;
    if (data.workPhone !== undefined) updateFields['Work Phone'] = data.workPhone;
    if (data.department !== undefined) updateFields['Department'] = data.department;
    if (data.startDate !== undefined) updateFields['Start Date'] = data.startDate;
    if (data.endDate !== undefined) updateFields['End Date'] = data.endDate;
    if (data.status !== undefined) updateFields['Status'] = data.status;

    console.log('Updating relationship:', id, updateFields);

    const record = await base(COMPANY_CONTACTS_TABLE).update(id, updateFields);

    return c.json({
      success: true,
      data: {
        id: record.id,
        fields: record.fields
      }
    });

  } catch (error) {
    console.error('Error updating relationship:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update relationship'
      },
      500
    );
  }
});

/**
 * DELETE /api/company-contacts/:id
 * Delete (or deactivate) a company-contact relationship
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const hardDelete = c.req.query('hard') === 'true';

    if (hardDelete) {
      // Permanently delete the record
      await base(COMPANY_CONTACTS_TABLE).destroy(id);
      return c.json({
        success: true,
        message: 'Relationship permanently deleted'
      });
    } else {
      // Soft delete: set status to Inactive and add end date
      const record = await base(COMPANY_CONTACTS_TABLE).update(id, {
        'Status': 'Inactive',
        'End Date': new Date().toISOString().split('T')[0]
      });

      return c.json({
        success: true,
        message: 'Relationship deactivated',
        data: {
          id: record.id,
          fields: record.fields
        }
      });
    }

  } catch (error) {
    console.error('Error deleting relationship:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete relationship'
      },
      500
    );
  }
});

/**
 * GET /api/company-contacts/contact/:contactId/companies
 * Get all companies a contact works for
 */
app.get('/contact/:contactId/companies', async (c) => {
  try {
    const contactId = c.req.param('contactId');
    const status = c.req.query('status') || 'Active';

    const relationships: any[] = [];

    await base(COMPANY_CONTACTS_TABLE)
      .select({
        filterByFormula: `AND({Contact ID}='${contactId}', {Status}='${status}')`,
        sort: [{ field: 'Is Primary Contact', direction: 'desc' }]
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          relationships.push({
            relationshipId: record.id,
            companyId: record.fields['Company ID'],
            companyName: record.fields['Company Name'],
            role: record.fields['Role'],
            isPrimary: record.fields['Is Primary Contact'] || false,
            workEmail: record.fields['Work Email'],
            workPhone: record.fields['Work Phone'],
            department: record.fields['Department'],
            startDate: record.fields['Start Date'],
            endDate: record.fields['End Date']
          });
        });
        fetchNextPage();
      });

    return c.json({
      success: true,
      contactId,
      companies: relationships,
      count: relationships.length
    });

  } catch (error) {
    console.error('Error fetching contact companies:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch companies'
      },
      500
    );
  }
});

/**
 * GET /api/company-contacts/company/:companyId/contacts
 * Get all contacts for a company
 */
app.get('/company/:companyId/contacts', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const status = c.req.query('status') || 'Active';

    const relationships: any[] = [];

    await base(COMPANY_CONTACTS_TABLE)
      .select({
        filterByFormula: `AND({Company ID}='${companyId}', {Status}='${status}')`,
        sort: [{ field: 'Is Primary Contact', direction: 'desc' }]
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          relationships.push({
            relationshipId: record.id,
            contactId: record.fields['Contact ID'],
            contactName: record.fields['Contact Name'],
            role: record.fields['Role'],
            isPrimary: record.fields['Is Primary Contact'] || false,
            workEmail: record.fields['Work Email'],
            workPhone: record.fields['Work Phone'],
            department: record.fields['Department'],
            startDate: record.fields['Start Date'],
            endDate: record.fields['End Date']
          });
        });
        fetchNextPage();
      });

    return c.json({
      success: true,
      companyId,
      contacts: relationships,
      count: relationships.length
    });

  } catch (error) {
    console.error('Error fetching company contacts:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch contacts'
      },
      500
    );
  }
});

/**
 * POST /api/company-contacts/contact/:contactId/set-primary
 * Set a contact as primary for a specific company
 */
app.post('/contact/:contactId/set-primary', async (c) => {
  try {
    const contactId = c.req.param('contactId');
    const { companyId } = await c.req.json();

    if (!companyId) {
      return c.json(
        { success: false, error: 'Company ID is required' },
        400
      );
    }

    // First, set all other contacts for this company to non-primary
    const allContacts = await base(COMPANY_CONTACTS_TABLE)
      .select({
        filterByFormula: `AND({Company ID}='${companyId}', {Status}='Active')`
      })
      .firstPage();

    const updatePromises = allContacts.map(record =>
      base(COMPANY_CONTACTS_TABLE).update(record.id, {
        'Is Primary Contact': false
      })
    );

    await Promise.all(updatePromises);

    // Now set the specified contact as primary
    const targetRelationship = allContacts.find(
      record => record.fields['Contact ID'] === contactId
    );

    if (!targetRelationship) {
      return c.json(
        { success: false, error: 'Contact-Company relationship not found' },
        404
      );
    }

    const updatedRecord = await base(COMPANY_CONTACTS_TABLE).update(
      targetRelationship.id,
      { 'Is Primary Contact': true }
    );

    return c.json({
      success: true,
      message: 'Primary contact updated',
      data: {
        id: updatedRecord.id,
        fields: updatedRecord.fields
      }
    });

  } catch (error) {
    console.error('Error setting primary contact:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set primary contact'
      },
      500
    );
  }
});

export default app;
