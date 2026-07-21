/**
 * View API Routes (Postgres-backed)
 *
 * Legacy generic "fetch an Airtable view / record by table name" endpoint,
 * now serving from Postgres in the original response shape. Every table this
 * endpoint is ever asked for has been migrated — there is no Airtable
 * fallback left. Unknown table names return 404.
 */

import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  personal,
  corporations,
  personalPipelineTickets,
  corporatePipelineTickets,
  salesTaxCertificates,
} from '../db/schema';
import {
  personalToAirtableRecord,
  corporationToAirtableRecord,
  personalFieldsToColumns,
  corporationFieldsToColumns,
  loadPersonalRelationships,
  computeClientCode,
  type AirtableShapedRecord,
} from '../db/serializers';
import {
  loadSubsPersonalContext,
  loadSubsCorporateContext,
  subsPersonalToAirtableRecord,
  subsCorporateToAirtableRecord,
} from '../db/serializers-subscriptions';

const app = new Hono();

// Tables served by this endpoint, all Postgres-backed.
const MIGRATED_TABLES = new Set([
  'Personal',
  'Corporations',
  'Subscriptions Personal',
  'Subscriptions Corporate',
  'Sales Tax Certificate Info',
]);
// Single-record GET/POST/PATCH by table name only support the entity tables
// (the only ones the client uses that way).
const MIGRATED_ENTITY_TABLES = new Set(['Personal', 'Corporations']);

function salesTaxCertToAirtableRecord(
  row: typeof salesTaxCertificates.$inferSelect
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};
  if (row.stCertificate) fields['ST Certificate'] = row.stCertificate;
  if (row.companyName) {
    fields['Company Name'] = row.companyName;
    // Legacy lookup name the client reads for search-result display.
    fields['Company Name (from Status)'] = row.companyName;
  }
  if (row.businessPartner != null) fields['Business Partner'] = row.businessPartner;
  if (row.frequency) fields['Frequency'] = row.frequency;
  if (row.corporationId) fields['Company Name (from Company Name (from Status))'] = [row.corporationId];
  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

/**
 * Recompute corporations.st_certificate_values / business_partner_numbers
 * (denormalized display snapshots) from sales_tax_certificates whenever a
 * corporation's linked certificate IDs change, so the snapshot never drifts.
 */
async function refreshStCertSnapshot(
  db: ReturnType<typeof getDb>,
  values: Partial<typeof corporations.$inferInsert>
): Promise<void> {
  if (!values.stCertificateNumberIds || values.stCertificateNumberIds.length === 0) return;

  const certs = await db
    .select()
    .from(salesTaxCertificates)
    .where(inArray(salesTaxCertificates.id, values.stCertificateNumberIds));

  values.stCertificateValues = certs.map((c) => c.stCertificate).filter((v): v is string => Boolean(v));
  values.businessPartnerNumbers = certs
    .map((c) => c.businessPartner)
    .filter((v): v is number => v != null)
    .map(String);
}

async function fetchMigratedRecords(tableName: string): Promise<AirtableShapedRecord[]> {
  const db = getDb();
  if (tableName === 'Personal') {
    const rows = await db.select().from(personal);
    const { relMap, lookup } = await loadPersonalRelationships(db);
    return rows.map((row) => personalToAirtableRecord(row, relMap.get(row.id), lookup));
  }
  if (tableName === 'Subscriptions Personal') {
    const rows = await db.select().from(personalPipelineTickets);
    const ctx = await loadSubsPersonalContext(db);
    return rows.map((row) => subsPersonalToAirtableRecord(row, ctx));
  }
  if (tableName === 'Subscriptions Corporate') {
    const rows = await db.select().from(corporatePipelineTickets);
    const ctx = await loadSubsCorporateContext(db);
    return rows.map((row) => subsCorporateToAirtableRecord(row, ctx));
  }
  if (tableName === 'Sales Tax Certificate Info') {
    const rows = await db.select().from(salesTaxCertificates);
    return rows.map(salesTaxCertToAirtableRecord);
  }
  const rows = await db.select().from(corporations);
  return rows.map(corporationToAirtableRecord);
}

/**
 * GET /api/view
 * Fetch all records of a migrated table (legacy Airtable "view" response
 * shape). View/sort/filter params are ignored — no consumer needs them.
 */
app.get('/', async (c) => {
  try {
    const requestedTable = c.req.query('table') || 'Subscriptions Corporate';

    if (!MIGRATED_TABLES.has(requestedTable)) {
      return c.json(
        { success: false, error: `Unknown table "${requestedTable}"` },
        404
      );
    }

    const records = await fetchMigratedRecords(requestedTable);
    const fieldNames = records.length > 0 ? Object.keys(records[0].fields) : [];
    const recentRecords = [...records]
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .slice(0, 5);

    return c.json({
      success: true,
      data: {
        records,
        stats: {
          totalRecords: records.length,
          fieldCount: fieldNames.length,
          tableName: requestedTable,
          viewName: c.req.query('view') || 'Grid view',
          lastUpdated: new Date().toISOString(),
          recentActivity:
            recentRecords.length > 0
              ? new Date(recentRecords[0].createdTime).toLocaleString()
              : 'No recent activity',
        },
        fieldNames,
        fieldTypes: {},
        recentRecords,
        queryParams: {
          tableName: requestedTable,
          viewName: c.req.query('view') || 'Grid view',
        },
      },
    });
  } catch (error) {
    console.error('Error in view API route:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch view data',
      },
      500
    );
  }
});

/**
 * GET /api/view/:tableName/:recordId
 * Get a specific record by ID from a table
 */
app.get('/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const recordId = c.req.param('recordId');

    if (!MIGRATED_ENTITY_TABLES.has(tableName)) {
      return c.json(
        { success: false, error: `Unknown table "${tableName}"`, table: tableName, recordId },
        404
      );
    }

    const db = getDb();
    if (tableName === 'Personal') {
      const [row] = await db.select().from(personal).where(eq(personal.id, recordId)).limit(1);
      if (!row) {
        return c.json({ success: false, error: 'Record not found', table: tableName, recordId }, 404);
      }
      const { relMap, lookup } = await loadPersonalRelationships(db, [recordId]);
      return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(recordId), lookup) });
    }
    const [row] = await db.select().from(corporations).where(eq(corporations.id, recordId)).limit(1);
    if (!row) {
      return c.json({ success: false, error: 'Record not found', table: tableName, recordId }, 404);
    }
    return c.json({ success: true, data: corporationToAirtableRecord(row) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch record';
    console.error(`[View API] Error fetching record ${c.req.param('recordId')} from table "${c.req.param('tableName')}":`, errorMessage);
    return c.json(
      {
        success: false,
        error: errorMessage,
        table: c.req.param('tableName'),
        recordId: c.req.param('recordId'),
      },
      500
    );
  }
});

/**
 * POST /api/view/:tableName
 * Create a new record in the specified table
 */
app.post('/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json({ success: false, error: 'Missing required field: fields' }, 400);
    }

    if (!MIGRATED_ENTITY_TABLES.has(tableName)) {
      return c.json({ success: false, error: `Unknown table "${tableName}"` }, 404);
    }

    console.log(`Creating record in table "${tableName}"`, fields);

    const db = getDb();
    if (tableName === 'Personal') {
      const values = personalFieldsToColumns(fields);
      values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ssn ?? null);
      const [row] = await db.insert(personal).values(values).returning();
      const { relMap, lookup } = await loadPersonalRelationships(db, [row.id]);
      return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(row.id), lookup) }, 201);
    }
    const values = corporationFieldsToColumns(fields);
    values.clientCode = computeClientCode(values.clientCodeOverride ?? null, values.ein ?? null);
    await refreshStCertSnapshot(db, values);
    const [row] = await db.insert(corporations).values(values).returning();
    return c.json({ success: true, data: corporationToAirtableRecord(row) }, 201);
  } catch (error) {
    console.error('Error creating record:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create record' },
      500
    );
  }
});

/**
 * PATCH /api/view/:tableName/:recordId
 * Update a record in the specified table
 */
app.patch('/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName');
    const recordId = c.req.param('recordId');
    const { fields } = await c.req.json();

    if (!fields) {
      return c.json({ success: false, error: 'Missing required field: fields' }, 400);
    }

    if (!MIGRATED_ENTITY_TABLES.has(tableName)) {
      return c.json({ success: false, error: `Unknown table "${tableName}"` }, 404);
    }

    console.log(`Updating record ${recordId} in table "${tableName}"`, fields);

    const db = getDb();
    if (tableName === 'Personal') {
      const values = personalFieldsToColumns(fields);
      const [existing] = await db.select().from(personal).where(eq(personal.id, recordId)).limit(1);
      if (!existing) {
        return c.json({ success: false, error: 'Record not found' }, 404);
      }
      values.clientCode = computeClientCode(
        (values.clientCodeOverride ?? existing.clientCodeOverride) || null,
        (values.ssn ?? existing.ssn) || null
      );
      const [row] = await db.update(personal).set(values).where(eq(personal.id, recordId)).returning();
      const { relMap, lookup } = await loadPersonalRelationships(db, [recordId]);
      return c.json({ success: true, data: personalToAirtableRecord(row, relMap.get(recordId), lookup) });
    }
    const values = corporationFieldsToColumns(fields);
    const [existing] = await db.select().from(corporations).where(eq(corporations.id, recordId)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: 'Record not found' }, 404);
    }
    values.clientCode = computeClientCode(
      (values.clientCodeOverride ?? existing.clientCodeOverride) || null,
      (values.ein ?? existing.ein) || null
    );
    await refreshStCertSnapshot(db, values);
    const [row] = await db.update(corporations).set(values).where(eq(corporations.id, recordId)).returning();
    return c.json({ success: true, data: corporationToAirtableRecord(row) });
  } catch (error) {
    console.error('Error updating record:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update record' },
      500
    );
  }
});

export default app;
