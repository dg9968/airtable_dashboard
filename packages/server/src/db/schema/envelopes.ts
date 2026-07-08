import { pgTable, pgEnum, text, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';
import { documents } from './documents';
import { personal, corporations } from './people';
import { signingTemplates } from './catalogs';

// SignNow/DocuSign lifecycle, enforced by routes/docusign-envelopes.ts
// (statusMap normalizes webhook payloads onto this exact set).
export const envelopeStatus = pgEnum('envelope_status', [
  'Created',
  'Sent',
  'Delivered',
  'Viewed',
  'Signed',
  'Completed',
  'Declined',
  'Voided',
]);

// Airtable "Signing Envelopes" — one row per document sent for e-signature.
// Files (source + signed) live in Google Drive; only Drive IDs are stored.
export const signingEnvelopes = pgTable(
  'signing_envelopes',
  {
    id: id(),
    status: envelopeStatus('status').default('Created').notNull(),
    clientType: text('client_type'), // 'Personal' | 'Corporate'
    signerEmail: text('signer_email'),
    signerName: text('signer_name'),
    signer2Email: text('signer2_email'),
    signer2Name: text('signer2_name'),
    taxYear: text('tax_year'),
    documentType: text('document_type'), // 1040 | 1120 | 1120S | 1065 | 990 | 8879 | Other
    sourceDriveFileId: text('source_drive_file_id'),
    createdBy: text('created_by'),
    documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
    personalId: text('personal_id').references(() => personal.id, { onDelete: 'set null' }),
    corporationId: text('corporation_id').references(() => corporations.id, { onDelete: 'set null' }),
    templateUsedId: text('template_used_id').references(() => signingTemplates.id, { onDelete: 'set null' }),
    envelopeId: text('envelope_id'), // SignNow/DocuSign external ID
    errorMessage: text('error_message'),
    sentAt: text('sent_at'),
    completedAt: text('completed_at'),
    signedDriveFileId: text('signed_drive_file_id'),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    index('signing_envelopes_status_idx').on(t.status),
    index('signing_envelopes_envelope_id_idx').on(t.envelopeId),
    index('signing_envelopes_document_idx').on(t.documentId),
    index('signing_envelopes_personal_idx').on(t.personalId),
    index('signing_envelopes_corporation_idx').on(t.corporationId),
  ]
);
