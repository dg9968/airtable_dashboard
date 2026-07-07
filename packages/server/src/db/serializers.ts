/**
 * Compat serializers: rebuild the legacy Airtable record shape
 * ({ id, fields: { 'Original Field Name': value }, createdTime }) from
 * Postgres rows, and map legacy field names back to columns for writes.
 *
 * Field names here intentionally preserve Airtable's quirks (emoji keys,
 * '❓Status', lookups like 'Spouse First Name') so API responses stay
 * byte-compatible with what the client already parses. Empty values are
 * omitted, matching Airtable's behavior of dropping empty fields.
 */

import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { personal, personalRelationships } from './schema';

type PersonalRow = typeof personal.$inferSelect;
type CorporationRow = typeof schema.corporations.$inferSelect;

export interface AirtableShapedRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

function put(fields: Record<string, unknown>, name: string, value: unknown) {
  if (value === null || value === undefined || value === '') return;
  if (Array.isArray(value) && value.length === 0) return;
  fields[name] = value;
}

// ---------------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------------

export interface PersonalRelInfo {
  spouseIds: string[];
  childIds: string[];
  parentIds: string[];
  dependentIds: string[];
}

export type RelMap = Map<string, PersonalRelInfo>;
/** Minimal info about related persons needed for spouse lookup fields. */
export type PersonLookup = Map<string, { firstName: string | null; lastName: string | null; clientCode: string | null }>;

const EMPTY_RELS: PersonalRelInfo = { spouseIds: [], childIds: [], parentIds: [], dependentIds: [] };

/**
 * Load relationship links (and the person info needed for spouse lookups) for
 * the given personal ids — or all rows when ids is undefined.
 */
export async function loadPersonalRelationships(
  db: NodePgDatabase<typeof schema>,
  personalIds?: string[]
): Promise<{ relMap: RelMap; lookup: PersonLookup }> {
  const relMap: RelMap = new Map();
  if (personalIds !== undefined && personalIds.length === 0) {
    return { relMap, lookup: new Map() };
  }

  const rels = await db
    .select()
    .from(personalRelationships)
    .where(personalIds ? inArray(personalRelationships.personalId, personalIds) : undefined);

  for (const rel of rels) {
    const info = relMap.get(rel.personalId) ?? {
      spouseIds: [], childIds: [], parentIds: [], dependentIds: [],
    };
    if (rel.relationship === 'spouse') info.spouseIds.push(rel.relatedPersonalId);
    else if (rel.relationship === 'child') info.childIds.push(rel.relatedPersonalId);
    else if (rel.relationship === 'parent') info.parentIds.push(rel.relatedPersonalId);
    else if (rel.relationship === 'dependent') info.dependentIds.push(rel.relatedPersonalId);
    relMap.set(rel.personalId, info);
  }

  const relatedIds = [...new Set(rels.map((r) => r.relatedPersonalId))];
  const lookup: PersonLookup = new Map();
  if (relatedIds.length > 0) {
    const relatedRows = await db
      .select({
        id: personal.id,
        firstName: personal.firstName,
        lastName: personal.lastName,
        clientCode: personal.clientCode,
      })
      .from(personal)
      .where(inArray(personal.id, relatedIds));
    for (const row of relatedRows) {
      lookup.set(row.id, { firstName: row.firstName, lastName: row.lastName, clientCode: row.clientCode });
    }
  }

  return { relMap, lookup };
}

export function personalToAirtableRecord(
  row: PersonalRow,
  rels: PersonalRelInfo = EMPTY_RELS,
  lookup: PersonLookup = new Map()
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};

  const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
  const lastFirst = [row.lastName, row.firstName].filter(Boolean).join(' ');

  put(fields, 'Record ID', row.id);
  put(fields, 'First Name', row.firstName);
  put(fields, 'Last Name', row.lastName);
  put(fields, 'Full Name', fullName);
  put(fields, 'last name first name', lastFirst);
  put(fields, 'Client Code', row.clientCode);
  put(fields, 'Client Code Override', row.clientCodeOverride);
  put(fields, 'SSN', row.ssn);
  put(fields, 'Tax Year', row.taxYear);
  put(fields, 'Date of Birth', row.dateOfBirth);
  put(fields, 'Mailing Address', row.mailingAddress);
  put(fields, 'City', row.city);
  put(fields, 'State', row.state);
  put(fields, 'ZIP', row.zip);
  put(fields, 'Email', row.email);
  put(fields, 'Prior Year AGI', row.priorYearAgi != null ? Number(row.priorYearAgi) : null);
  put(fields, '📞Phone number', row.phone);
  put(fields, '❓Status', row.status);
  put(fields, 'Filing Status', row.filingStatus);
  put(fields, 'Account Type', row.accountType);
  put(fields, 'Preferred Contact', row.preferredContact);
  put(fields, 'Associate Responsible', row.associateResponsible);
  put(fields, 'Occupation', row.occupation);
  put(fields, 'Driver License', row.driverLicense);
  put(fields, 'Identity Protection PIN', row.identityProtectionPin);
  put(fields, 'Bank Name', row.bankName);
  put(fields, 'Account Number', row.accountNumber);
  put(fields, 'Routing Number', row.routingNumber);
  put(fields, 'Secondary Phone', row.secondaryPhone);
  put(fields, 'Corporate', row.corporateName);
  put(fields, 'Spouse Name', row.spouseName);
  put(fields, 'Spouse SSN', row.spouseSsn);
  put(fields, 'Spouse DOB', row.spouseDob);
  put(fields, 'Spouse Occupation', row.spouseOccupation);

  // Self-links + spouse lookup fields
  put(fields, 'Spouse (Linked)', rels.spouseIds);
  put(fields, 'Child (Linked)', rels.childIds);
  put(fields, 'Parent (Linked)', rels.parentIds);
  put(fields, 'Dependent (Linked)', rels.dependentIds);
  if (rels.spouseIds.length > 0) {
    const spouses = rels.spouseIds.map((id) => lookup.get(id)).filter(Boolean) as NonNullable<
      ReturnType<PersonLookup['get']>
    >[];
    put(fields, 'Spouse First Name', spouses.map((s) => s.firstName).filter(Boolean));
    put(fields, 'Spouse Last Name', spouses.map((s) => s.lastName).filter(Boolean));
    put(fields, 'Spouse Client Code', spouses.map((s) => s.clientCode).find(Boolean) ?? null);
  }

  // Snapshots of links to not-yet-migrated tables
  put(fields, 'Subscriptions Personal', row.subscriptionsPersonalIds);
  put(fields, 'Tax Documents', row.taxDocumentsIds);
  put(fields, 'Signing Envelopes', row.signingEnvelopesIds);
  put(fields, 'Bank Info', row.bankInfoIds);

  return {
    id: row.id,
    createdTime: row.createdAt.toISOString(),
    fields,
  };
}

export function computeClientCode(override: string | null, ssnOrEin: string | null): string | null {
  if (override) return override;
  const digits = (ssnOrEin ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * Map legacy Airtable field names to personal columns for POST/PATCH bodies.
 * Unknown and computed/lookup fields are silently ignored (the old code
 * stripped them before sending to Airtable).
 */
export function personalFieldsToColumns(
  fields: Record<string, unknown>
): Partial<typeof personal.$inferInsert> {
  const out: Partial<typeof personal.$inferInsert> = {};
  const map: Record<string, keyof typeof personal.$inferInsert> = {
    'First Name': 'firstName',
    'Last Name': 'lastName',
    'Client Code Override': 'clientCodeOverride',
    'SSN': 'ssn',
    'Date of Birth': 'dateOfBirth',
    'Mailing Address': 'mailingAddress',
    'City': 'city',
    'State': 'state',
    'ZIP': 'zip',
    'Email': 'email',
    'Personal Email': 'email',
    '📞Phone number': 'phone',
    'Phone': 'phone',
    'Personal Phone': 'phone',
    '❓Status': 'status',
    'Status': 'status',
    'Filing Status': 'filingStatus',
    'Account Type': 'accountType',
    'Preferred Contact': 'preferredContact',
    'Occupation': 'occupation',
    'Driver License': 'driverLicense',
    'Drivers License / State ID': 'driverLicense',
    'Identity Protection PIN': 'identityProtectionPin',
    'Bank Name': 'bankName',
    'Account Number': 'accountNumber',
    'Routing Number': 'routingNumber',
    'Secondary Phone': 'secondaryPhone',
    'Corporate': 'corporateName',
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === '' || value === undefined || value === null) continue;
    if (key === 'Tax Year') {
      const n = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(n)) out.taxYear = n;
    } else if (key === 'Prior Year AGI') {
      const n = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(n)) out.priorYearAgi = String(n);
    } else if (key === 'Associate Responsible') {
      out.associateResponsible = Array.isArray(value) ? value.map(String) : [String(value)];
    } else {
      const col = map[key];
      if (col) (out as Record<string, unknown>)[col] = value;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Corporations
// ---------------------------------------------------------------------------

export function corporationToAirtableRecord(row: CorporationRow): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};

  put(fields, 'Company', row.company);
  put(fields, 'EIN', row.ein);
  put(fields, 'Client Code', row.clientCode);
  put(fields, 'Client Code Override', row.clientCodeOverride);
  put(fields, '🤷‍♂️Email', row.email);
  put(fields, 'Phone', row.phone);
  put(fields, 'Language Preference', row.languagePreference);
  put(fields, 'ADDRESS', row.address);
  put(fields, 'CITY', row.city);
  put(fields, 'STATE', row.state);
  put(fields, 'ZIP CODE', row.zip);
  put(fields, 'Sunbiz Document Number', row.sunbizDocumentNumber);
  put(fields, 'Entity Number', row.entityNumber);
  put(fields, 'Type of Entity', row.typeOfEntity);
  put(fields, 'Type', row.type);
  put(fields, 'Date Incorporated', row.dateIncorporated);
  put(fields, 'Fiscal Year End', row.fiscalYearEnd);
  put(fields, 'Registered Agent', row.registeredAgent);
  put(fields, 'Contact', row.contact);
  put(fields, 'Industry', row.industry);
  put(fields, 'Website', row.website);
  put(fields, 'Notas', row.notas);
  put(fields, 'Notes', row.notes);
  put(fields, 'ST Certificate Number', row.stCertificateNumberIds);
  put(fields, 'ST Certificate', row.stCertificateValues);
  put(fields, 'Business Partner (from ST Certificate Number)', row.businessPartnerNumbers);
  put(fields, '2025 Corporate Tax Returns Link', row.taxReturns2025Ids);
  put(fields, 'Unemployment and Income Tax Accounts', row.unemploymentAccountIds);
  put(fields, 'Communications Corporate', row.communicationsCorporateIds);
  put(fields, 'Subscriptions', row.subscriptionsIds);

  return {
    id: row.id,
    createdTime: row.createdAt.toISOString(),
    fields,
  };
}

/** Map legacy Airtable field names to corporations columns for writes. */
export function corporationFieldsToColumns(
  fields: Record<string, unknown>
): Partial<typeof schema.corporations.$inferInsert> {
  const out: Partial<typeof schema.corporations.$inferInsert> = {};
  const map: Record<string, keyof typeof schema.corporations.$inferInsert> = {
    'Company': 'company',
    'Company Name': 'company',
    'Name': 'company',
    'Name ': 'company',
    'Business Name': 'company',
    'Legal Name': 'company',
    'EIN': 'ein',
    'Tax ID': 'ein',
    'Client Code Override': 'clientCodeOverride',
    '🤷‍♂️Email': 'email',
    'Email': 'email',
    'Phone': 'phone',
    'Phone Number': 'phone',
    'Language Preference': 'languagePreference',
    'ADDRESS': 'address',
    'Address': 'address',
    'CITY': 'city',
    'City': 'city',
    'STATE': 'state',
    'State': 'state',
    'ZIP CODE': 'zip',
    'Zip Code': 'zip',
    'ZIP': 'zip',
    'Sunbiz Document Number': 'sunbizDocumentNumber',
    'Entity Number': 'entityNumber',
    'Business Partner Number': 'entityNumber',
    'Type of Entity': 'typeOfEntity',
    'Type': 'type',
    'Date Incorporated': 'dateIncorporated',
    'Fiscal Year End': 'fiscalYearEnd',
    'Registered Agent': 'registeredAgent',
    'Contact': 'contact',
    'Industry': 'industry',
    'Website': 'website',
    'Notas': 'notas',
    'Notes': 'notes',
  };
  const arrayMap: Record<string, keyof typeof schema.corporations.$inferInsert> = {
    'ST Certificate Number': 'stCertificateNumberIds',
    '2025 Corporate Tax Returns Link': 'taxReturns2025Ids',
    'Unemployment and Income Tax Accounts': 'unemploymentAccountIds',
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === '' || value === undefined || value === null) continue;
    const arrCol = arrayMap[key];
    if (arrCol) {
      (out as Record<string, unknown>)[arrCol] = Array.isArray(value) ? value.map(String) : [String(value)];
      continue;
    }
    const col = map[key];
    if (col) (out as Record<string, unknown>)[col] = value;
  }

  return out;
}
