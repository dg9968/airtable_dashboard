/**
 * Company_Contacts Junction Table Routes
 * Manages the many-to-many relationship between Contacts and Companies
 */

import { Hono } from 'hono';
import {
  fetchRecords,
  findRecord,
  createRecords,
  updateRecords,
  deleteRecords,
  getTable
} from '../lib/airtable-service';

const app = new Hono();

const COMPANY_CONTACTS_TABLE = 'Company_Contacts';
const CONTACTS_TABLE = 'Personal';
const COMPANIES_TABLE = 'Corporations';

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

    const records = await fetchRecords(COMPANY_CONTACTS_TABLE, { maxRecords: 100 });

    // Log first record to inspect field names
    if (records.length > 0) {
      console.log('Sample Company_Contacts record fields:', Object.keys(records[0].fields));
      console.log('Total records found:', records.length);
    }

    const relationships = records
      .map((record) => {
        // Extract contact and company IDs from linked record fields
        const recordContactId = Array.isArray(record.fields['Contact']) ? record.fields['Contact'][0] : record.fields['Contact'];
        const recordCompanyId = Array.isArray(record.fields['Company']) ? record.fields['Company'][0] : record.fields['Company'];

        return {
          id: record.id,
          contactId: recordContactId,
          companyId: recordCompanyId,
          contactName: record.fields['Contact Name (from Contact)'] || record.fields['Contact Name'],
          companyName: record.fields['Company Name (from Company)'] || record.fields['Company Name'],
          role: record.fields['Role'],
          isPrimary: record.fields['Is Primary Contact'] || false,
          workEmail: record.fields['Work Email'],
          workPhone: record.fields['Work Phone'],
          department: record.fields['Department'],
          startDate: record.fields['Start Date'],
          endDate: record.fields['End Date'],
          status: record.fields['Status'] || 'Active',
          createdTime: record.createdTime
        };
      })
      .filter((rel) => {
        // Apply filtering in code
        const matchesContact = !contactId || String(rel.contactId) === String(contactId);
        const matchesCompany = !companyId || String(rel.companyId) === String(companyId);
        const matchesStatus = !status || String(rel.status) === String(status);
        return matchesContact && matchesCompany && matchesStatus;
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

    const record = await findRecord(COMPANY_CONTACTS_TABLE, id);

    return c.json({
      success: true,
      data: {
        id: record.id,
        contactId: Array.isArray(record.fields['Contact']) ? record.fields['Contact'][0] : record.fields['Contact'],
        companyId: Array.isArray(record.fields['Company']) ? record.fields['Company'][0] : record.fields['Company'],
        contactName: record.fields['Contact Name (from Contact)'] || record.fields['Contact Name'],
        companyName: record.fields['Company Name (from Company)'] || record.fields['Company Name'],
        role: record.fields['Role'],
        isPrimary: record.fields['Is Primary Contact'] || false,
        workEmail: record.fields['Work Email'],
        workPhone: record.fields['Work Phone'],
        department: record.fields['Department'],
        startDate: record.fields['Start Date'],
        endDate: record.fields['End Date'],
        status: record.fields['Status'] || 'Active',
        createdTime: record.createdTime
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

    // Check if relationship already exists - fetch all and filter in code
    const existing = await fetchRecords(COMPANY_CONTACTS_TABLE, { maxRecords: 100 });

    const duplicate = existing.find(record => {
      const contactMatch = Array.isArray(record.fields['Contact'])
        ? record.fields['Contact'].includes(data.contactId)
        : record.fields['Contact'] === data.contactId;

      const companyMatch = Array.isArray(record.fields['Company'])
        ? record.fields['Company'].includes(data.companyId)
        : record.fields['Company'] === data.companyId;

      return contactMatch && companyMatch && record.fields['Status'] === 'Active';
    });

    if (duplicate) {
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

    const record = await createRecords(COMPANY_CONTACTS_TABLE, [
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

    const records = await updateRecords(COMPANY_CONTACTS_TABLE, [
      { id, fields: updateFields }
    ]);

    return c.json({
      success: true,
      data: {
        id: records[0].id,
        fields: records[0].fields
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
      await deleteRecords(COMPANY_CONTACTS_TABLE, [id]);
      return c.json({
        success: true,
        message: 'Relationship permanently deleted'
      });
    } else {
      // Soft delete: set status to Inactive and add end date
      const records = await updateRecords(COMPANY_CONTACTS_TABLE, [
        {
          id,
          fields: {
            'Status': 'Inactive',
            'End Date': new Date().toISOString().split('T')[0]
          }
        }
      ]);

      return c.json({
        success: true,
        message: 'Relationship deactivated',
        data: {
          id: records[0].id,
          fields: records[0].fields
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

    const records = await fetchRecords(COMPANY_CONTACTS_TABLE, { maxRecords: 100 });

    const relationships = records
      .filter((record) => {
        const recordContactId = Array.isArray(record.fields['Contact']) ? record.fields['Contact'][0] : record.fields['Contact'];
        const matchesContact = String(recordContactId) === String(contactId);
        const matchesStatus = String(record.fields['Status']) === String(status);
        return matchesContact && matchesStatus;
      })
      .map((record) => ({
        relationshipId: record.id,
        companyId: Array.isArray(record.fields['Company']) ? record.fields['Company'][0] : record.fields['Company'],
        companyName: record.fields['Company Name (from Company)'] || record.fields['Company Name'],
        role: record.fields['Role'],
        isPrimary: record.fields['Is Primary Contact'] || false,
        workEmail: record.fields['Work Email'],
        workPhone: record.fields['Work Phone'],
        department: record.fields['Department'],
        startDate: record.fields['Start Date'],
        endDate: record.fields['End Date']
      }));

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

    const records = await fetchRecords(COMPANY_CONTACTS_TABLE, { maxRecords: 100 });

    const relationships = records
      .filter((record) => {
        const recordCompanyId = Array.isArray(record.fields['Company']) ? record.fields['Company'][0] : record.fields['Company'];
        const matchesCompany = String(recordCompanyId) === String(companyId);
        const matchesStatus = String(record.fields['Status']) === String(status);
        return matchesCompany && matchesStatus;
      })
      .map((record) => ({
        relationshipId: record.id,
        contactId: Array.isArray(record.fields['Contact']) ? record.fields['Contact'][0] : record.fields['Contact'],
        contactName: record.fields['Contact Name (from Contact)'] || record.fields['Contact Name'],
        role: record.fields['Role'],
        isPrimary: record.fields['Is Primary Contact'] || false,
        workEmail: record.fields['Work Email'],
        workPhone: record.fields['Work Phone'],
        department: record.fields['Department'],
        startDate: record.fields['Start Date'],
        endDate: record.fields['End Date']
      }));

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

    // First, fetch all relationships for this company
    const allContacts = await fetchRecords(COMPANY_CONTACTS_TABLE, { maxRecords: 100 });

    // Filter for the specific company and active status
    const companyContacts = allContacts.filter(record => {
      const recordCompanyId = Array.isArray(record.fields['Company']) ? record.fields['Company'][0] : record.fields['Company'];
      return String(recordCompanyId) === String(companyId) && record.fields['Status'] === 'Active';
    });

    // Set all contacts for this company to non-primary
    if (companyContacts.length > 0) {
      await updateRecords(
        COMPANY_CONTACTS_TABLE,
        companyContacts.map(record => ({
          id: record.id,
          fields: { 'Is Primary Contact': false }
        }))
      );
    }

    // Now find and set the specified contact as primary
    const targetRelationship = companyContacts.find(record => {
      const recordContactId = Array.isArray(record.fields['Contact']) ? record.fields['Contact'][0] : record.fields['Contact'];
      return String(recordContactId) === String(contactId);
    });

    if (!targetRelationship) {
      return c.json(
        { success: false, error: 'Contact-Company relationship not found' },
        404
      );
    }

    const updatedRecords = await updateRecords(COMPANY_CONTACTS_TABLE, [
      {
        id: targetRelationship.id,
        fields: { 'Is Primary Contact': true }
      }
    ]);

    return c.json({
      success: true,
      message: 'Primary contact updated',
      data: {
        id: updatedRecords[0].id,
        fields: updatedRecords[0].fields
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

/**
 * GET /api/company-contacts/service/:serviceName/subscribers
 * Get all subscribers of a specific service with their contact information
 */
app.get('/service/:serviceName/subscribers', async (c) => {
  try {
    const serviceName = c.req.param('serviceName');
    const includeInactive = c.req.query('includeInactive') === 'true';

    console.log(`\n[Service Subscribers] Searching for service: "${serviceName}"`);

    // Step 1: Fetch all services and find matching service IDs
    const SERVICES_TABLE = 'Services Corporate';
    const matchingServiceIds: string[] = [];

    const servicesRecords = await fetchRecords(SERVICES_TABLE, {});
    servicesRecords.forEach((record, index) => {
      const serviceNameField = record.fields['Services']
        || record.fields['Service']
        || record.fields['Service Name']
        || record.fields['Name'];

      // Debug: Log first 3 services to see what we have
      if (index < 3) {
        console.log(`Service #${index + 1}: "${serviceNameField}" (${record.id})`, {
          allFields: Object.keys(record.fields),
          fields: record.fields
        });
      }

      if (serviceNameField && String(serviceNameField).toLowerCase().includes(serviceName.toLowerCase())) {
        matchingServiceIds.push(record.id);
        console.log(`✓ Found matching service: "${serviceNameField}" (${record.id})`);
      }
    });

    console.log(`[Service Subscribers] Found ${matchingServiceIds.length} matching service IDs`);

    if (matchingServiceIds.length === 0) {
      return c.json({
        success: true,
        serviceName,
        subscribers: [],
        count: 0,
        totalContacts: 0,
        message: `No service found matching "${serviceName}"`
      });
    }

    // Step 2: Query Subscriptions Corporate junction table to find company IDs with this service
    const SUBSCRIPTIONS_TABLE = 'Subscriptions Corporate';
    const companyIdsWithService: Set<string> = new Set();

    const subscriptionsRecords = await fetchRecords(SUBSCRIPTIONS_TABLE, {});
    subscriptionsRecords.forEach((record, subscriptionCount) => {

          // Field is called "Services" (plural) and "Customer" (not Company)
          const serviceIds = record.fields['Services']; // This is an array of service IDs
          const companyId = Array.isArray(record.fields['Customer'])
            ? record.fields['Customer'][0]
            : record.fields['Customer'];

          // Try various possible status field names
          // Status might be an array (multiple select field) or a string
          let status = record.fields['Status']
            || record.fields['Active']
            || record.fields['Is Active']
            || record.fields['Subscription Status'];

          // If status is an array (multiple select), check if it contains 'Active'
          const statusValue = Array.isArray(status) ? status : [status];

          // Debug: Log first 10 subscriptions to see all field data
          // Including both matching and non-matching to understand structure
          if (subscriptionCount < 10) {
            const allFields = Object.keys(record.fields);
            const hasMatchingService = serviceIds && Array.isArray(serviceIds) && serviceIds.some(sid =>
              matchingServiceIds.includes(String(sid))
            );

            console.log(`Subscription #${subscriptionCount + 1}${hasMatchingService ? ' [MATCHES SERVICE]' : ''}:`, {
              name: record.fields['Name'],
              serviceIds,
              servicesCount: Array.isArray(serviceIds) ? serviceIds.length : 0,
              companyId,
              status,
              statusValue,
              statusType: Array.isArray(status) ? 'array' : typeof status,
              allFields,
              // Show sample of field values to understand structure
              sampleFields: Object.fromEntries(
                Object.entries(record.fields)
                  .filter(([key]) => !key.includes('(from'))
                  .slice(0, 8)
              )
            });
          }

          // Check if this subscription has any of the matching service IDs AND is Active
          if (serviceIds && Array.isArray(serviceIds) && companyId) {
            const hasMatchingService = serviceIds.some(sid =>
              matchingServiceIds.includes(String(sid))
            );

            // Filter by Status = 'Active'
            // Status could be a string or an array (multiple select field)
            const isActive = statusValue.includes('Active');

            if (hasMatchingService && isActive) {
              companyIdsWithService.add(String(companyId));
              console.log(`✓ Found ACTIVE subscription: Company ${companyId} -> Services ${serviceIds.join(', ')} | Status: ${JSON.stringify(status)}`);
            } else if (hasMatchingService && !isActive) {
              // Log filtered out subscriptions for debugging
              if (subscriptionCount < 20) {
                console.log(`  [Filtered] Company ${companyId} has service but Status is ${JSON.stringify(status)} (not Active)`);
              }
            }
          }
        });

    console.log(`[Service Subscribers] Found ${companyIdsWithService.size} companies with service "${serviceName}"`);

    if (companyIdsWithService.size === 0) {
      return c.json({
        success: true,
        serviceName,
        subscribers: [],
        count: 0,
        totalContacts: 0,
        message: `No companies subscribed to "${serviceName}"`
      });
    }

    // Step 3: Fetch company details for the matching companies
    const companiesRecords = await fetchRecords(COMPANIES_TABLE, {});
    const companiesWithService = companiesRecords
      .filter(record => companyIdsWithService.has(record.id))
      .map(record => ({
        id: record.id,
        name: record.fields['Company'] || record.fields['Company Name'],
        email: record.fields['🤷‍♂️Email'] || record.fields['Email'],
        phone: record.fields['Phone'],
        ein: record.fields['EIN'],
        subscriptions: []
      }));

    // Step 4: Fetch all Company_Contacts relationships
    const relationshipsRecords = await fetchRecords(COMPANY_CONTACTS_TABLE, {});
    const allRelationships = relationshipsRecords
      .filter(record => {
        const status = record.fields['Status'];
        return includeInactive || status === 'Active';
      })
      .map(record => ({
        id: record.id,
        contactId: Array.isArray(record.fields['Contact'])
          ? record.fields['Contact'][0]
          : record.fields['Contact'],
        companyId: Array.isArray(record.fields['Company'])
          ? record.fields['Company'][0]
          : record.fields['Company'],
        role: record.fields['Role'],
        isPrimary: record.fields['Is Primary Contact'] || false,
        workEmail: record.fields['Work Email'],
        workPhone: record.fields['Work Phone'],
        department: record.fields['Department'],
        status: record.fields['Status']
      }));

    // Step 5: Fetch all contacts to enrich the data
    const contactsRecords = await fetchRecords(CONTACTS_TABLE, {});
    const allContacts: Map<string, any> = new Map();
    contactsRecords.forEach(record => {
      allContacts.set(record.id, {
        id: record.id,
        name: record.fields['Full Name'] || record.fields['Name'],
        email: record.fields['Email'],
        phone: record.fields['📞Phone number'] || record.fields['Phone'],
        status: record.fields['Status'] || record.fields['❓Status']
      });
    });

    // Step 6: Build the enriched response
    const subscribers = companiesWithService.map(company => {
      // Find all contacts for this company
      const companyRelationships = allRelationships.filter(
        rel => String(rel.companyId) === String(company.id)
      );

      const contacts = companyRelationships.map(rel => {
        const contactInfo = allContacts.get(rel.contactId);
        return {
          relationshipId: rel.id,
          contactId: rel.contactId,
          name: contactInfo?.name || 'Unknown',
          personalEmail: contactInfo?.email,
          personalPhone: contactInfo?.phone,
          workEmail: rel.workEmail,
          workPhone: rel.workPhone,
          role: rel.role,
          department: rel.department,
          isPrimary: rel.isPrimary,
          status: rel.status
        };
      });

      return {
        companyId: company.id,
        companyName: company.name,
        companyEmail: company.email,
        companyPhone: company.phone,
        ein: company.ein,
        subscriptions: company.subscriptions,
        contacts: contacts,
        primaryContact: contacts.find(c => c.isPrimary) || contacts[0] || null
      };
    });

    return c.json({
      success: true,
      serviceName,
      subscribers,
      count: subscribers.length,
      totalContacts: subscribers.reduce((sum, sub) => sum + sub.contacts.length, 0)
    });

  } catch (error) {
    console.error('Error fetching service subscribers:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch service subscribers'
      },
      500
    );
  }
});

export default app;
