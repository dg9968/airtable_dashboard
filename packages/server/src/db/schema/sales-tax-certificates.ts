import { pgTable, text, integer, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';
import { corporations } from './people';

// Airtable "Sales Tax Certificate Info" — one row per state sales-tax
// certificate/location. Linked from Corporations via a link field historically
// named "ST Certificate Number" (its display name looks like a lookup, but it
// holds record IDs — Airtable lets you rename a Link field to anything).
// Discovered during Phase 6 (not in the original 6-domain inventory): used by
// the Corporate Client Intake "ST Certificate" search, previously served
// straight from Airtable.
export const salesTaxCertificates = pgTable(
  'sales_tax_certificates',
  {
    id: id(),
    stCertificate: text('st_certificate'),
    companyName: text('company_name'), // own stored text field, not a lookup
    businessPartner: integer('business_partner'),
    frequency: text('frequency'),
    corporationId: text('corporation_id').references(() => corporations.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('sales_tax_certificates_corporation_idx').on(t.corporationId)]
);
