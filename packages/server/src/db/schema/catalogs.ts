import { pgTable, text, integer, numeric, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';

// Airtable "Personal Services" — service catalog for individual clients.
export const personalServices = pgTable('personal_services', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

// Airtable "Services Corporate" — corporate service catalog.
export const servicesCorporate = pgTable('services_corporate', {
  id: id(),
  name: text('name').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }),
  description: text('description'),
  category: text('category'),
  billingCycle: text('billing_cycle'),
  createdAt: createdAt(),
});

// Airtable "Message Templates". Date fields are text on purpose: routes read and
// write them as plain strings (YYYY-MM-DD), and preserving the exact Airtable
// values keeps API responses byte-compatible.
export const messageTemplates = pgTable(
  'message_templates',
  {
    id: id(),
    templateName: text('template_name').notNull(),
    templateCode: text('template_code'),
    subjectTemplate: text('subject_template'),
    contentTemplate: text('content_template'),
    description: text('description'),
    variableDefinitions: text('variable_definitions'), // JSON string, parsed by routes
    category: text('category'),
    status: text('status'),
    createdDate: text('created_date'),
    lastUsedDate: text('last_used_date'),
    createdAt: createdAt(),
  },
  (t) => [index('message_templates_status_idx').on(t.status)]
);

// Airtable "Signing Templates" (Dropbox Sign / SignNow). Table migrates in
// Phase 1; the docusign-envelopes routes cut over in Phase 5.
export const signingTemplates = pgTable('signing_templates', {
  id: id(),
  templateName: text('template_name').notNull(),
  templateCode: text('template_code'),
  dropboxSignTemplateId: text('dropbox_sign_template_id'),
  documentTypes: text('document_types').array(),
  clientType: text('client_type'),
  numberOfSigners: integer('number_of_signers'),
  description: text('description'),
  status: text('status'),
  sortOrder: integer('sort_order'),
  createdAt: createdAt(),
});
