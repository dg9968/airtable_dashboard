import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';

// Airtable "Personal" — the central clients/people table (720 records at
// migration). Column set derives from a full field inventory of live data plus
// the fields routes write. Date-ish fields stay text to preserve Airtable's
// exact strings. Fields that are Airtable formulas/lookups (Full Name, Spouse
// First/Last Name, Spouse Client Code) are computed in serializers, not stored.
// Link arrays to not-yet-migrated tables are kept as *_ids snapshots and get
// replaced by live joins when those phases land.
export const personal = pgTable(
  'personal',
  {
    id: id(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    // Materialized value of the Airtable "Client Code" formula:
    // COALESCE(override, last 4 digits of SSN)
    clientCode: text('client_code'),
    clientCodeOverride: text('client_code_override'),
    ssn: text('ssn'),
    taxYear: integer('tax_year'),
    dateOfBirth: text('date_of_birth'),
    mailingAddress: text('mailing_address'),
    city: text('city'),
    state: text('state'),
    zip: text('zip'),
    email: text('email'),
    priorYearAgi: numeric('prior_year_agi'),
    phone: text('phone'), // Airtable "📞Phone number"
    status: text('status'), // Airtable "❓Status"
    filingStatus: text('filing_status'),
    accountType: text('account_type'), // bank account type
    preferredContact: text('preferred_contact'),
    associateResponsible: text('associate_responsible').array(), // multi-select
    occupation: text('occupation'),
    driverLicense: text('driver_license'), // "Driver License" / "Drivers License / State ID"
    identityProtectionPin: text('identity_protection_pin'),
    bankName: text('bank_name'),
    accountNumber: text('account_number'),
    routingNumber: text('routing_number'),
    secondaryPhone: text('secondary_phone'),
    corporateName: text('corporate_name'), // Airtable "Corporate" (free text)
    // Legacy spouse text fields (superseded by personal_relationships)
    spouseName: text('spouse_name'),
    spouseSsn: text('spouse_ssn'),
    spouseDob: text('spouse_dob'),
    spouseOccupation: text('spouse_occupation'),
    // Link snapshots to not-yet-migrated tables (replaced by joins in later phases)
    subscriptionsPersonalIds: text('subscriptions_personal_ids').array(),
    taxDocumentsIds: text('tax_documents_ids').array(),
    signingEnvelopesIds: text('signing_envelopes_ids').array(),
    bankInfoIds: text('bank_info_ids').array(),
    createdAt: createdAt(),
  },
  (t) => [
    index('personal_client_code_idx').on(t.clientCode),
    index('personal_email_idx').on(t.email),
    index('personal_ssn_idx').on(t.ssn),
    index('personal_last_name_idx').on(t.lastName),
  ]
);

// Replaces the Personal self-link fields: Spouse (Linked), Child (Linked),
// Parent (Linked), Dependent (Linked). Spouse links are stored bidirectionally
// (two rows), matching Airtable. PK is deterministic
// (`${personalId}:${relationship}:${relatedPersonalId}`) so the ETL is idempotent.
export const personalRelationships = pgTable(
  'personal_relationships',
  {
    id: text('id').primaryKey(),
    personalId: text('personal_id')
      .notNull()
      .references(() => personal.id, { onDelete: 'cascade' }),
    relatedPersonalId: text('related_personal_id')
      .notNull()
      .references(() => personal.id, { onDelete: 'cascade' }),
    relationship: text('relationship').notNull(), // 'spouse' | 'child' | 'parent' | 'dependent'
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('personal_relationships_unique_idx').on(
      t.personalId,
      t.relatedPersonalId,
      t.relationship
    ),
    index('personal_relationships_personal_idx').on(t.personalId),
    index('personal_relationships_related_idx').on(t.relatedPersonalId),
  ]
);

// Airtable "Corporations" (422 records at migration). "Registered Agent" and
// its summary are Airtable AI-generated object fields — only the .value string
// is kept. Alias fields (Company/Company Name/Name/..., ADDRESS/Address, ...)
// are collapsed by the ETL into single columns.
export const corporations = pgTable(
  'corporations',
  {
    id: id(),
    company: text('company'),
    ein: text('ein'),
    clientCode: text('client_code'), // materialized formula: COALESCE(override, last 4 of EIN)
    clientCodeOverride: text('client_code_override'),
    email: text('email'), // Airtable "🤷‍♂️Email"
    phone: text('phone'),
    languagePreference: text('language_preference'),
    address: text('address'),
    city: text('city'),
    state: text('state'),
    zip: text('zip'),
    sunbizDocumentNumber: text('sunbiz_document_number'),
    entityNumber: text('entity_number'),
    typeOfEntity: text('type_of_entity'),
    type: text('type'), // Airtable "Type" (e.g. "1065")
    dateIncorporated: text('date_incorporated'),
    fiscalYearEnd: text('fiscal_year_end'),
    registeredAgent: text('registered_agent'), // .value of the AI field
    contact: text('contact'),
    industry: text('industry'),
    website: text('website'),
    notas: text('notas'),
    notes: text('notes'),
    // Link snapshots (source tables not migrated; re-emitted by serializers)
    stCertificateNumberIds: text('st_certificate_number_ids').array(),
    stCertificateValues: text('st_certificate_values').array(),
    businessPartnerNumbers: text('business_partner_numbers').array(),
    taxReturns2025Ids: text('tax_returns_2025_ids').array(),
    unemploymentAccountIds: text('unemployment_account_ids').array(),
    communicationsCorporateIds: text('communications_corporate_ids').array(),
    subscriptionsIds: text('subscriptions_ids').array(),
    createdAt: createdAt(),
  },
  (t) => [
    index('corporations_client_code_idx').on(t.clientCode),
    index('corporations_ein_idx').on(t.ein),
    index('corporations_company_idx').on(t.company),
  ]
);

// Airtable "Company_Contacts" — junction between Personal and Corporations.
export const companyContacts = pgTable(
  'company_contacts',
  {
    id: id(),
    contactId: text('contact_id').references(() => personal.id, { onDelete: 'set null' }),
    corporationId: text('corporation_id').references(() => corporations.id, { onDelete: 'set null' }),
    role: text('role'),
    isPrimaryContact: boolean('is_primary_contact').default(false).notNull(),
    workEmail: text('work_email'),
    workPhone: text('work_phone'),
    department: text('department'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    status: text('status'),
    legacyAutoNumber: integer('legacy_auto_number'), // Airtable "Company_Contacts ID"
    createdAt: createdAt(),
  },
  (t) => [
    index('company_contacts_contact_idx').on(t.contactId),
    index('company_contacts_corporation_idx').on(t.corporationId),
  ]
);
