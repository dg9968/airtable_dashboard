import { pgTable, text, integer, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';

// Airtable "Documents" — file METADATA only (7,372 records at migration).
// The binaries live in Google Drive; this table stores the Drive pointers.
// tax_year is text on purpose (values include "N/A"). (client_code, tax_year)
// is the dominant lookup — every document fetch filters on both.
export const documents = pgTable(
  'documents',
  {
    id: id(),
    clientCode: text('client_code'),
    taxYear: text('tax_year'),
    fileName: text('file_name'),
    originalName: text('original_name'),
    uploadDate: text('upload_date'),
    fileSize: integer('file_size'),
    fileType: text('file_type'),
    uploadedBy: text('uploaded_by'),
    googleDriveFileId: text('google_drive_file_id'),
    webViewLink: text('web_view_link'),
    webContentLink: text('web_content_link'),
    documentCategory: text('document_category'),
    bankName: text('bank_name'),
    signingEnvelopesIds: text('signing_envelopes_ids').array(), // snapshot until Phase 5
    createdAt: createdAt(),
  },
  (t) => [
    index('documents_client_year_idx').on(t.clientCode, t.taxYear),
    index('documents_gdrive_idx').on(t.googleDriveFileId),
  ]
);
