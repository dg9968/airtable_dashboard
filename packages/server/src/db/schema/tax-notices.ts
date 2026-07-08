import { pgTable, pgEnum, text, boolean, numeric, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';

// The 14-state workflow enforced by routes/tax-notices.ts (STATUS_TRANSITIONS).
// An enum (unlike the free-text Status columns elsewhere) because the route
// code enforces this exact closed set.
export const taxNoticeStatus = pgEnum('tax_notice_status', [
  'New Notice',
  'Scanned / Uploaded',
  'Initial Review',
  'Waiting on Client',
  'Research / Drafting',
  'Drafting Response',
  'Awaiting Client Signature',
  'Response Signed',
  'Needs Daniel Review',
  'Ready to Submit',
  'Submitted',
  'Waiting on Agency',
  'Resolved',
  'Closed / Archived',
]);

// Airtable "Tax Notices" — IRS/state notice workflow. Letter binaries live in
// Google Drive (letter_drive_id); dates stay text (YYYY-MM-DD strings).
export const taxNotices = pgTable(
  'tax_notices',
  {
    id: id(),
    status: taxNoticeStatus('status').default('New Notice').notNull(),
    clientName: text('client_name'),
    entityName: text('entity_name'),
    noticeAgency: text('notice_agency'),
    noticeNumber: text('notice_number'),
    taxYear: text('tax_year'),
    taxType: text('tax_type'),
    dateReceived: text('date_received'),
    responseDueDate: text('response_due_date'),
    amountDue: numeric('amount_due'),
    noticeCategory: text('notice_category'),
    assignedOwner: text('assigned_owner'),
    supportingTeamMember: text('supporting_team_member'),
    priority: text('priority'),
    danielReviewRequired: boolean('daniel_review_required').default(false).notNull(),
    clientDocumentsNeeded: text('client_documents_needed'),
    responseFiledDate: text('response_filed_date'),
    proofOfSubmissionUploaded: boolean('proof_of_submission_uploaded').default(false).notNull(),
    finalResolution: text('final_resolution'),
    createdBy: text('created_by'),
    letterDriveId: text('letter_drive_id'),
    letterViewUrl: text('letter_view_url'),
    letterFileName: text('letter_file_name'),
    responseSentToClientDate: text('response_sent_to_client_date'),
    clientSignatureDate: text('client_signature_date'),
    responseSentToAgencyDate: text('response_sent_to_agency_date'),
    responseSubmissionMethod: text('response_submission_method'),
    createdAt: createdAt(),
  },
  (t) => [
    index('tax_notices_status_idx').on(t.status),
    index('tax_notices_due_date_idx').on(t.responseDueDate),
  ]
);

export const taxNoticeNotes = pgTable(
  'tax_notice_notes',
  {
    id: id(),
    taxNoticeId: text('tax_notice_id').references(() => taxNotices.id, { onDelete: 'cascade' }),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('tax_notice_notes_notice_idx').on(t.taxNoticeId)]
);

export const taxNoticeAttachments = pgTable(
  'tax_notice_attachments',
  {
    id: id(),
    taxNoticeId: text('tax_notice_id').references(() => taxNotices.id, { onDelete: 'cascade' }),
    fileName: text('file_name'),
    driveId: text('drive_id'),
    viewUrl: text('view_url'),
    fileType: text('file_type'), // original-letter | additional-pages | response-draft | signed-response | proof-of-submission | other
    uploadedBy: text('uploaded_by'),
    createdAt: createdAt(),
  },
  (t) => [index('tax_notice_attachments_notice_idx').on(t.taxNoticeId)]
);
