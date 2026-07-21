/**
 * Company_Contacts Junction Table Routes (Postgres-backed)
 * Manages the many-to-many relationship between contacts (personal) and
 * companies (corporations).
 *
 * NOTE: the /service/:serviceName/subscribers endpoint is hybrid during the
 * migration — services + entities + relationships come from Postgres, but
 * subscriptions still come from Airtable until Phase 3.
 */

import { Hono } from 'hono';
import { and, eq, ilike, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../db/client';
import { companyContacts, corporations, personal, servicesCorporate, corporatePipelineTickets } from '../db/schema';

const app = new Hono();

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

const contactPerson = alias(personal, 'contact_person');

/** Select relationships joined with contact + company names. */
function selectRelationships() {
  return getDb()
    .select({
      rel: companyContacts,
      contactFirstName: contactPerson.firstName,
      contactLastName: contactPerson.lastName,
      companyName: corporations.company,
    })
    .from(companyContacts)
    .leftJoin(contactPerson, eq(companyContacts.contactId, contactPerson.id))
    .leftJoin(corporations, eq(companyContacts.corporationId, corporations.id));
}

type JoinedRel = Awaited<ReturnType<ReturnType<typeof selectRelationships>['execute']>>[number];

function mapRelationship(r: JoinedRel) {
  const contactName = [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || undefined;
  return {
    id: r.rel.id,
    contactId: r.rel.contactId ?? undefined,
    companyId: r.rel.corporationId ?? undefined,
    contactName,
    companyName: r.companyName ?? undefined,
    role: r.rel.role ?? undefined,
    isPrimary: r.rel.isPrimaryContact || false,
    workEmail: r.rel.workEmail ?? undefined,
    workPhone: r.rel.workPhone ?? undefined,
    department: r.rel.department ?? undefined,
    startDate: r.rel.startDate ?? undefined,
    endDate: r.rel.endDate ?? undefined,
    status: r.rel.status || 'Active',
    createdTime: r.rel.createdAt.toISOString(),
  };
}

/** Legacy Airtable-shaped fields object for create/update responses. */
function relationshipFields(r: typeof companyContacts.$inferSelect): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (r.contactId) fields['Contact'] = [r.contactId];
  if (r.corporationId) fields['Company'] = [r.corporationId];
  if (r.role) fields['Role'] = r.role;
  if (r.isPrimaryContact) fields['Is Primary Contact'] = true;
  if (r.workEmail) fields['Work Email'] = r.workEmail;
  if (r.workPhone) fields['Work Phone'] = r.workPhone;
  if (r.department) fields['Department'] = r.department;
  if (r.startDate) fields['Start Date'] = r.startDate;
  if (r.endDate) fields['End Date'] = r.endDate;
  if (r.status) fields['Status'] = r.status;
  return fields;
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

    const conditions = [];
    if (contactId) conditions.push(eq(companyContacts.contactId, contactId));
    if (companyId) conditions.push(eq(companyContacts.corporationId, companyId));
    if (status) conditions.push(eq(companyContacts.status, status));

    const rows = await selectRelationships().where(
      conditions.length > 0 ? and(...conditions) : undefined
    );

    const relationships = rows.map(mapRelationship);

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

    const rows = await selectRelationships().where(eq(companyContacts.id, id)).limit(1);

    if (rows.length === 0) {
      return c.json({ success: false, error: 'Relationship not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRelationship(rows[0])
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

    const db = getDb();

    // Check if an active relationship already exists
    const duplicate = await db
      .select({ id: companyContacts.id })
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.contactId, data.contactId),
          eq(companyContacts.corporationId, data.companyId),
          eq(companyContacts.status, 'Active')
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      return c.json(
        { success: false, error: 'Active relationship already exists between this contact and company' },
        409
      );
    }

    const [row] = await db
      .insert(companyContacts)
      .values({
        contactId: data.contactId,
        corporationId: data.companyId,
        status: data.status || 'Active',
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        role: data.role || null,
        isPrimaryContact: data.isPrimary ?? false,
        workEmail: data.workEmail || null,
        workPhone: data.workPhone || null,
        department: data.department || null,
      })
      .returning();

    return c.json({
      success: true,
      data: {
        id: row.id,
        fields: relationshipFields(row)
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

    const values: Partial<typeof companyContacts.$inferInsert> = {};

    if (data.role !== undefined) values.role = data.role;
    if (data.isPrimary !== undefined) values.isPrimaryContact = data.isPrimary;
    if (data.workEmail !== undefined) values.workEmail = data.workEmail;
    if (data.workPhone !== undefined) values.workPhone = data.workPhone;
    if (data.department !== undefined) values.department = data.department;
    if (data.startDate !== undefined) values.startDate = data.startDate;
    if (data.endDate !== undefined) values.endDate = data.endDate;
    if (data.status !== undefined) values.status = data.status;

    console.log('Updating relationship:', id, values);

    const [row] = await getDb()
      .update(companyContacts)
      .set(values)
      .where(eq(companyContacts.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Relationship not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: row.id,
        fields: relationshipFields(row)
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

    const db = getDb();

    if (hardDelete) {
      await db.delete(companyContacts).where(eq(companyContacts.id, id));
      return c.json({
        success: true,
        message: 'Relationship permanently deleted'
      });
    } else {
      const [row] = await db
        .update(companyContacts)
        .set({
          status: 'Inactive',
          endDate: new Date().toISOString().split('T')[0],
        })
        .where(eq(companyContacts.id, id))
        .returning();

      if (!row) {
        return c.json({ success: false, error: 'Relationship not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Relationship deactivated',
        data: {
          id: row.id,
          fields: relationshipFields(row)
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

    const rows = await selectRelationships().where(
      and(eq(companyContacts.contactId, contactId), eq(companyContacts.status, status))
    );

    const relationships = rows.map((r) => ({
      relationshipId: r.rel.id,
      companyId: r.rel.corporationId ?? undefined,
      companyName: r.companyName ?? undefined,
      role: r.rel.role ?? undefined,
      isPrimary: r.rel.isPrimaryContact || false,
      workEmail: r.rel.workEmail ?? undefined,
      workPhone: r.rel.workPhone ?? undefined,
      department: r.rel.department ?? undefined,
      startDate: r.rel.startDate ?? undefined,
      endDate: r.rel.endDate ?? undefined
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

    const rows = await selectRelationships().where(
      and(eq(companyContacts.corporationId, companyId), eq(companyContacts.status, status))
    );

    const relationships = rows.map((r) => {
      const contactName =
        [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || 'Unknown Contact';
      return {
        relationshipId: r.rel.id,
        contactId: r.rel.contactId ?? undefined,
        contactName,
        role: r.rel.role ?? undefined,
        isPrimary: r.rel.isPrimaryContact || false,
        workEmail: r.rel.workEmail ?? undefined,
        workPhone: r.rel.workPhone ?? undefined,
        department: r.rel.department ?? undefined,
        startDate: r.rel.startDate ?? undefined,
        endDate: r.rel.endDate ?? undefined
      };
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

    const db = getDb();

    // Ensure the target relationship exists before clearing others
    const [target] = await db
      .select()
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.corporationId, companyId),
          eq(companyContacts.contactId, contactId),
          eq(companyContacts.status, 'Active')
        )
      )
      .limit(1);

    if (!target) {
      return c.json(
        { success: false, error: 'Contact-Company relationship not found' },
        404
      );
    }

    // Set all active contacts for this company to non-primary
    await db
      .update(companyContacts)
      .set({ isPrimaryContact: false })
      .where(
        and(
          eq(companyContacts.corporationId, companyId),
          eq(companyContacts.status, 'Active')
        )
      );

    const [row] = await db
      .update(companyContacts)
      .set({ isPrimaryContact: true })
      .where(eq(companyContacts.id, target.id))
      .returning();

    return c.json({
      success: true,
      message: 'Primary contact updated',
      data: {
        id: row.id,
        fields: relationshipFields(row)
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

    const db = getDb();

    // Step 1: Find matching service IDs (Postgres)
    const serviceRows = await db
      .select({ id: servicesCorporate.id, name: servicesCorporate.name })
      .from(servicesCorporate)
      .where(ilike(servicesCorporate.name, `%${serviceName}%`));

    const matchingServiceIds = serviceRows.map((s) => s.id);
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

    // Step 2: Find company IDs with an Active subscription to those services
    const companyIdsWithService: Set<string> = new Set();

    const subscriptionRows = await db
      .select({
        corporationId: corporatePipelineTickets.corporationId,
      })
      .from(corporatePipelineTickets)
      .where(
        and(
          inArray(corporatePipelineTickets.serviceId, matchingServiceIds),
          eq(corporatePipelineTickets.status, 'Active')
        )
      );
    for (const row of subscriptionRows) {
      if (row.corporationId) companyIdsWithService.add(row.corporationId);
    }

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

    // Step 3: Company details (Postgres)
    const companyRows = await db
      .select()
      .from(corporations)
      .where(inArray(corporations.id, [...companyIdsWithService]));

    const companiesWithService = companyRows.map((row) => ({
      id: row.id,
      name: row.company ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      ein: row.ein ?? undefined,
      subscriptions: [] as unknown[]
    }));

    // Step 4 + 5: Relationships joined with contact info (Postgres)
    const relRows = await selectRelationships();
    const allRelationships = relRows
      .filter((r) => includeInactive || r.rel.status === 'Active')
      .map((r) => ({
        id: r.rel.id,
        contactId: r.rel.contactId,
        companyId: r.rel.corporationId,
        role: r.rel.role ?? undefined,
        isPrimary: r.rel.isPrimaryContact || false,
        workEmail: r.rel.workEmail ?? undefined,
        workPhone: r.rel.workPhone ?? undefined,
        department: r.rel.department ?? undefined,
        status: r.rel.status ?? undefined,
        contactName: [r.contactFirstName, r.contactLastName].filter(Boolean).join(' ') || undefined,
      }));

    const contactIds = [...new Set(allRelationships.map((r) => r.contactId).filter(Boolean))] as string[];
    const contactRows = contactIds.length > 0
      ? await db.select().from(personal).where(inArray(personal.id, contactIds))
      : [];
    const allContacts = new Map(
      contactRows.map((row) => [
        row.id,
        {
          id: row.id,
          name: [row.firstName, row.lastName].filter(Boolean).join(' ') || undefined,
          email: row.email ?? undefined,
          phone: row.phone ?? undefined,
          status: row.status ?? undefined,
        },
      ])
    );

    // Step 6: Build the enriched response
    const subscribers = companiesWithService.map(company => {
      const companyRelationships = allRelationships.filter(
        rel => String(rel.companyId) === String(company.id)
      );

      const contacts = companyRelationships.map(rel => {
        const contactInfo = rel.contactId ? allContacts.get(rel.contactId) : undefined;
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
