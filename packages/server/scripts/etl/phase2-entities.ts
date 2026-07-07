/**
 * Phase 2 ETL: core entities.
 *
 *   Personal          → personal + personal_relationships
 *   Corporations      → corporations
 *   Company_Contacts  → company_contacts
 *
 * Also prints a client-code duplicate report (Airtable's "Client Code" formula
 * is COALESCE(override, last-4-of-SSN/EIN), so collisions are possible).
 *
 * Idempotent (upsert on rec ID / deterministic relationship ids). Usage:
 *   bun run packages/server/scripts/etl/phase2-entities.ts [--dry-run]
 */

import {
  requireEnv,
  isDryRun,
  fetchAll,
  pickString,
  pickNumber,
  pickBoolean,
  linkMany,
  upsert,
  newStats,
  report,
  getEtlDb,
  closeEtlDb,
  type EtlStats,
  type AirtableRecord,
} from './lib';
import {
  personal,
  personalRelationships,
  corporations,
  companyContacts,
} from '../../src/db/schema';

requireEnv();

/** Airtable AI-generated fields arrive as objects: { state, value, isStale }. */
function aiValue(fields: Record<string, unknown>, name: string): string | null {
  const v = fields[name];
  if (v && typeof v === 'object' && 'value' in (v as any)) {
    const value = (v as any).value;
    return typeof value === 'string' && value ? value : null;
  }
  return typeof v === 'string' && v ? v : null;
}

function stringArray(fields: Record<string, unknown>, name: string): string[] | null {
  const v = fields[name];
  return Array.isArray(v) && v.length > 0 ? v.map(String) : null;
}

function dupReport(stats: EtlStats, label: string, codes: (string | null)[]) {
  const seen = new Map<string, number>();
  for (const code of codes) {
    if (!code) continue;
    seen.set(code, (seen.get(code) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  if (dups.length > 0) {
    stats.warnings.push(
      `${label}: ${dups.length} duplicate client code(s): ${dups
        .slice(0, 10)
        .map(([code, n]) => `${code}×${n}`)
        .join(', ')}${dups.length > 10 ? ' …' : ''}`
    );
  }
}

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  // --- Personal ---
  const personalRecords: AirtableRecord[] = await fetchAll('Personal');
  const personalIds = new Set(personalRecords.map((r) => r.id));
  {
    const stats = newStats('Personal → personal');
    stats.fetched = personalRecords.length;
    const rows = personalRecords.map((r) => ({
      id: r.id,
      firstName: pickString(r.fields, 'First Name'),
      lastName: pickString(r.fields, 'Last Name'),
      clientCode: pickString(r.fields, 'Client Code'),
      clientCodeOverride: pickString(r.fields, 'Client Code Override'),
      ssn: pickString(r.fields, 'SSN'),
      taxYear: pickNumber(r.fields, 'Tax Year'),
      dateOfBirth: pickString(r.fields, 'Date of Birth'),
      mailingAddress: pickString(r.fields, 'Mailing Address'),
      city: pickString(r.fields, 'City'),
      state: pickString(r.fields, 'State'),
      zip: pickString(r.fields, 'ZIP'),
      email: pickString(r.fields, 'Email', 'Personal Email'),
      priorYearAgi: pickNumber(r.fields, 'Prior Year AGI')?.toString() ?? null,
      phone: pickString(r.fields, '📞Phone number', 'Phone', 'Personal Phone'),
      status: pickString(r.fields, '❓Status', 'Status'),
      filingStatus: pickString(r.fields, 'Filing Status'),
      accountType: pickString(r.fields, 'Account Type'),
      preferredContact: pickString(r.fields, 'Preferred Contact'),
      associateResponsible: stringArray(r.fields, 'Associate Responsible'),
      occupation: pickString(r.fields, 'Occupation'),
      driverLicense: pickString(r.fields, 'Driver License', 'Drivers License / State ID'),
      identityProtectionPin: pickString(r.fields, 'Identity Protection PIN'),
      bankName: pickString(r.fields, 'Bank Name'),
      accountNumber: pickString(r.fields, 'Account Number'),
      routingNumber: pickString(r.fields, 'Routing Number'),
      secondaryPhone: pickString(r.fields, 'Secondary Phone'),
      corporateName: pickString(r.fields, 'Corporate'),
      spouseName: pickString(r.fields, 'Spouse Name'),
      spouseSsn: pickString(r.fields, 'Spouse SSN'),
      spouseDob: pickString(r.fields, 'Spouse DOB'),
      spouseOccupation: pickString(r.fields, 'Spouse Occupation'),
      subscriptionsPersonalIds: stringArray(r.fields, 'Subscriptions Personal'),
      taxDocumentsIds: stringArray(r.fields, 'Tax Documents'),
      signingEnvelopesIds: stringArray(r.fields, 'Signing Envelopes'),
      bankInfoIds: stringArray(r.fields, 'Bank Info'),
      createdAt: new Date(r.createdTime),
    }));
    dupReport(stats, 'personal', rows.map((row) => row.clientCode));
    await upsert(db, personal, rows, stats);
    allStats.push(stats);
  }

  // --- personal_relationships (from self-link fields) ---
  {
    const stats = newStats('Personal links → personal_relationships');
    const linkFields: Array<[string, string]> = [
      ['Spouse (Linked)', 'spouse'],
      ['Child (Linked)', 'child'],
      ['Parent (Linked)', 'parent'],
      ['Dependent (Linked)', 'dependent'],
    ];
    const rows: Record<string, unknown>[] = [];
    for (const r of personalRecords) {
      for (const [field, relationship] of linkFields) {
        for (const relatedId of linkMany(r.fields, field)) {
          if (!personalIds.has(relatedId)) {
            stats.orphanLinks.push({ recordId: r.id, field, missingTarget: relatedId });
            continue;
          }
          rows.push({
            id: `${r.id}:${relationship}:${relatedId}`,
            personalId: r.id,
            relatedPersonalId: relatedId,
            relationship,
            createdAt: new Date(r.createdTime),
          });
        }
      }
    }
    stats.fetched = rows.length;
    await upsert(db, personalRelationships, rows, stats);
    allStats.push(stats);
  }

  // --- Corporations ---
  const corporationRecords: AirtableRecord[] = await fetchAll('Corporations');
  const corporationIds = new Set(corporationRecords.map((r) => r.id));
  {
    const stats = newStats('Corporations → corporations');
    stats.fetched = corporationRecords.length;
    const rows = corporationRecords.map((r) => ({
      id: r.id,
      company: pickString(
        r.fields,
        'Name ', // trailing space — the Airtable primary field
        'Company',
        'Company Name',
        'Name',
        'Business Name',
        'Legal Name'
      ),
      ein: pickString(r.fields, 'EIN', 'Tax ID'),
      clientCode: pickString(r.fields, 'Client Code'),
      clientCodeOverride: pickString(r.fields, 'Client Code Override'),
      email: pickString(r.fields, '🤷‍♂️Email', 'Email'),
      phone: pickString(r.fields, 'Phone', 'Phone Number'),
      languagePreference: pickString(r.fields, 'Language Preference'),
      address: pickString(r.fields, 'ADDRESS', 'Address'),
      city: pickString(r.fields, 'CITY', 'City'),
      state: pickString(r.fields, 'STATE', 'State'),
      zip: pickString(r.fields, 'ZIP CODE', 'Zip Code', 'ZIP'),
      sunbizDocumentNumber: pickString(r.fields, 'Sunbiz Document Number'),
      entityNumber: pickString(r.fields, 'Entity Number', 'Business Partner Number'),
      typeOfEntity: pickString(r.fields, 'Type of Entity'),
      type: pickString(r.fields, 'Type'),
      dateIncorporated: pickString(r.fields, 'Date Incorporated'),
      fiscalYearEnd: pickString(r.fields, 'Fiscal Year End'),
      registeredAgent: aiValue(r.fields, 'Registered Agent'),
      contact: pickString(r.fields, 'Contact'),
      industry: pickString(r.fields, 'Industry'),
      website: pickString(r.fields, 'Website'),
      notas: pickString(r.fields, 'Notas'),
      notes: pickString(r.fields, 'Notes'),
      stCertificateNumberIds: stringArray(r.fields, 'ST Certificate Number'),
      stCertificateValues: stringArray(r.fields, 'ST Certificate'),
      businessPartnerNumbers: stringArray(r.fields, 'Business Partner (from ST Certificate Number)'),
      taxReturns2025Ids: stringArray(r.fields, '2025 Corporate Tax Returns Link'),
      unemploymentAccountIds: stringArray(r.fields, 'Unemployment and Income Tax Accounts'),
      communicationsCorporateIds: stringArray(r.fields, 'Communications Corporate'),
      subscriptionsIds: stringArray(r.fields, 'Subscriptions'),
      createdAt: new Date(r.createdTime),
    }));
    dupReport(stats, 'corporations', rows.map((row) => row.clientCode));
    await upsert(db, corporations, rows, stats);
    allStats.push(stats);
  }

  // --- Company_Contacts ---
  {
    const stats = newStats('Company_Contacts → company_contacts');
    const records = await fetchAll('Company_Contacts');
    stats.fetched = records.length;
    const rows = records.map((r) => {
      const contactId = linkMany(r.fields, 'Contact')[0] ?? null;
      const corporationId = linkMany(r.fields, 'Company')[0] ?? null;
      if (contactId && !personalIds.has(contactId)) {
        stats.orphanLinks.push({ recordId: r.id, field: 'Contact', missingTarget: contactId });
      }
      if (corporationId && !corporationIds.has(corporationId)) {
        stats.orphanLinks.push({ recordId: r.id, field: 'Company', missingTarget: corporationId });
      }
      return {
        id: r.id,
        contactId: contactId && personalIds.has(contactId) ? contactId : null,
        corporationId: corporationId && corporationIds.has(corporationId) ? corporationId : null,
        role: pickString(r.fields, 'Role'),
        isPrimaryContact: pickBoolean(r.fields, 'Is Primary Contact'),
        workEmail: pickString(r.fields, 'Work Email'),
        workPhone: pickString(r.fields, 'Work Phone'),
        department: pickString(r.fields, 'Department'),
        startDate: pickString(r.fields, 'Start Date'),
        endDate: pickString(r.fields, 'End Date'),
        status: pickString(r.fields, 'Status'),
        legacyAutoNumber: pickNumber(r.fields, 'Company_Contacts ID'),
        createdAt: new Date(r.createdTime),
      };
    });
    await upsert(db, companyContacts, rows, stats);
    allStats.push(stats);
  }

  report(allStats);
  if (isDryRun) console.log('Dry run complete — nothing written.');
  await closeEtlDb();
}

main().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
