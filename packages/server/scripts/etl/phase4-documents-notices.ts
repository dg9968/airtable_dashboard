/**
 * Phase 4 ETL: documents + tax notices.
 *
 *   Documents               → documents (file metadata; binaries stay in Drive)
 *   Tax Notices             → tax_notices (Status must fit the pgEnum — fails loudly)
 *   Tax Notice Notes        → tax_notice_notes
 *   Tax Notice Attachments  → tax_notice_attachments
 *
 * Idempotent (upsert on rec ID). Usage:
 *   bun run packages/server/scripts/etl/phase4-documents-notices.ts [--dry-run]
 */

import {
  requireEnv,
  isDryRun,
  fetchAll,
  pickString,
  pickNumber,
  pickBoolean,
  linkOne,
  upsert,
  newStats,
  report,
  getEtlDb,
  closeEtlDb,
  type EtlStats,
} from './lib';
import {
  documents,
  taxNotices,
  taxNoticeNotes,
  taxNoticeAttachments,
} from '../../src/db/schema';

requireEnv();

const VALID_STATUSES = new Set([
  'New Notice', 'Scanned / Uploaded', 'Initial Review', 'Waiting on Client',
  'Research / Drafting', 'Drafting Response', 'Awaiting Client Signature',
  'Response Signed', 'Needs Daniel Review', 'Ready to Submit', 'Submitted',
  'Waiting on Agency', 'Resolved', 'Closed / Archived',
]);

function stringArray(fields: Record<string, unknown>, name: string): string[] | null {
  const v = fields[name];
  return Array.isArray(v) && v.length > 0 ? v.map(String) : null;
}

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  // --- Documents (7k+ records) ---
  {
    const stats = newStats('Documents → documents');
    const records = await fetchAll('Documents');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      clientCode: pickString(r.fields, 'Client Code'),
      taxYear: pickString(r.fields, 'Tax Year'),
      fileName: pickString(r.fields, 'File Name'),
      originalName: pickString(r.fields, 'Original Name'),
      uploadDate: pickString(r.fields, 'Upload Date'),
      fileSize: pickNumber(r.fields, 'File Size'),
      fileType: pickString(r.fields, 'File Type'),
      uploadedBy: pickString(r.fields, 'Uploaded By'),
      googleDriveFileId: pickString(r.fields, 'Google Drive File ID'),
      webViewLink: pickString(r.fields, 'Web View Link'),
      webContentLink: pickString(r.fields, 'Web Content Link'),
      documentCategory: pickString(r.fields, 'Document Category'),
      bankName: pickString(r.fields, 'Bank Name'),
      signingEnvelopesIds: stringArray(r.fields, 'Signing Envelopes'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, documents, rows, stats);
    allStats.push(stats);
  }

  // --- Tax Notices ---
  const noticeRecords = await fetchAll('Tax Notices');
  const noticeIds = new Set(noticeRecords.map((r) => r.id));
  {
    const stats = newStats('Tax Notices → tax_notices');
    stats.fetched = noticeRecords.length;

    // Enum guard: fail loudly on any status outside the state machine
    for (const r of noticeRecords) {
      const status = pickString(r.fields, 'Status') ?? 'New Notice';
      if (!VALID_STATUSES.has(status)) {
        throw new Error(`Tax notice ${r.id} has status "${status}" outside the state machine — resolve in Airtable before migrating`);
      }
    }

    const rows = noticeRecords.map((r) => ({
      id: r.id,
      status: (pickString(r.fields, 'Status') ?? 'New Notice') as any,
      clientName: pickString(r.fields, 'Client Name'),
      entityName: pickString(r.fields, 'Entity Name'),
      noticeAgency: pickString(r.fields, 'Notice Agency'),
      noticeNumber: pickString(r.fields, 'Notice Number'),
      taxYear: pickString(r.fields, 'Tax Year'),
      taxType: pickString(r.fields, 'Tax Type'),
      dateReceived: pickString(r.fields, 'Date Received'),
      responseDueDate: pickString(r.fields, 'Response Due Date'),
      amountDue: pickNumber(r.fields, 'Amount Due')?.toString() ?? null,
      noticeCategory: pickString(r.fields, 'Notice Category'),
      assignedOwner: pickString(r.fields, 'Assigned Owner'),
      supportingTeamMember: pickString(r.fields, 'Supporting Team Member'),
      priority: pickString(r.fields, 'Priority'),
      danielReviewRequired: pickBoolean(r.fields, 'Daniel Review Required'),
      clientDocumentsNeeded: pickString(r.fields, 'Client Documents Needed'),
      responseFiledDate: pickString(r.fields, 'Response Filed Date'),
      proofOfSubmissionUploaded: pickBoolean(r.fields, 'Proof of Submission Uploaded'),
      finalResolution: pickString(r.fields, 'Final Resolution'),
      createdBy: pickString(r.fields, 'Created By'),
      letterDriveId: pickString(r.fields, 'Letter Drive ID'),
      letterViewUrl: pickString(r.fields, 'Letter View URL'),
      letterFileName: pickString(r.fields, 'Letter File Name'),
      responseSentToClientDate: pickString(r.fields, 'Response Sent to Client Date'),
      clientSignatureDate: pickString(r.fields, 'Client Signature Date'),
      responseSentToAgencyDate: pickString(r.fields, 'Response Sent to Agency Date'),
      responseSubmissionMethod: pickString(r.fields, 'Response Submission Method'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, taxNotices, rows, stats);
    allStats.push(stats);
  }

  // --- Tax Notice Notes ---
  {
    const stats = newStats('Tax Notice Notes → tax_notice_notes');
    const records = await fetchAll('Tax Notice Notes');
    stats.fetched = records.length;
    const rows = records.map((r) => {
      const noticeId = linkOne(r.fields, 'Tax Notice');
      if (noticeId && !noticeIds.has(noticeId)) {
        stats.orphanLinks.push({ recordId: r.id, field: 'Tax Notice', missingTarget: noticeId });
      }
      return {
        id: r.id,
        taxNoticeId: noticeId && noticeIds.has(noticeId) ? noticeId : null,
        authorName: pickString(r.fields, 'Author Name'),
        authorEmail: pickString(r.fields, 'Author Email'),
        note: pickString(r.fields, 'Note'),
        createdAt: new Date(r.createdTime),
      };
    });
    await upsert(db, taxNoticeNotes, rows, stats);
    allStats.push(stats);
  }

  // --- Tax Notice Attachments ---
  {
    const stats = newStats('Tax Notice Attachments → tax_notice_attachments');
    const records = await fetchAll('Tax Notice Attachments');
    stats.fetched = records.length;
    const rows = records.map((r) => {
      const noticeId = linkOne(r.fields, 'Tax Notice');
      if (noticeId && !noticeIds.has(noticeId)) {
        stats.orphanLinks.push({ recordId: r.id, field: 'Tax Notice', missingTarget: noticeId });
      }
      return {
        id: r.id,
        taxNoticeId: noticeId && noticeIds.has(noticeId) ? noticeId : null,
        fileName: pickString(r.fields, 'File Name'),
        driveId: pickString(r.fields, 'Drive ID'),
        viewUrl: pickString(r.fields, 'View URL'),
        fileType: pickString(r.fields, 'File Type'),
        uploadedBy: pickString(r.fields, 'Uploaded By'),
        createdAt: new Date(r.createdTime),
      };
    });
    await upsert(db, taxNoticeAttachments, rows, stats);
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
