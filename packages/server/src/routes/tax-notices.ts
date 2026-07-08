/**
 * Tax Notices API Routes (Postgres-backed)
 *
 * IRS/state notice workflow: intake auto-triage, a 14-state status machine,
 * response lifecycle dates, and letter storage in Google Drive.
 */

import { Hono } from 'hono';
import { and, eq, ilike, inArray, ne, not, or, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { taxNotices } from '../db/schema';
import { uploadTaxNoticeLetter, downloadFileFromGoogleDrive, deleteFileFromGoogleDrive, getFileMetadata } from '../googleDrive';

const app = new Hono();
const HIGH_DOLLAR_THRESHOLD = 2000;

const DANIEL_CATEGORIES = new Set(['Audit', 'Collections', 'Levy/Lien', 'Garnishment', 'Appeal']);
const DANIEL_TAX_TYPES = new Set(['Business', 'Payroll']);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  'New Notice': ['Scanned / Uploaded'],
  'Scanned / Uploaded': ['Initial Review'],
  'Initial Review': ['Waiting on Client', 'Research / Drafting'],
  'Waiting on Client': ['Research / Drafting'],
  'Research / Drafting': ['Needs Daniel Review', 'Drafting Response', 'Ready to Submit'],
  'Drafting Response': ['Awaiting Client Signature', 'Needs Daniel Review'],
  'Awaiting Client Signature': ['Response Signed'],
  'Response Signed': ['Ready to Submit'],
  'Needs Daniel Review': ['Drafting Response', 'Ready to Submit'],
  'Ready to Submit': ['Submitted'],
  'Submitted': ['Waiting on Agency'],
  'Waiting on Agency': ['Resolved'],
  'Resolved': ['Closed / Archived'],
  'Closed / Archived': [],
};

function computeDaysUntilDue(dueDateStr: string): number {
  if (!dueDateStr) return 999;
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function autoTriage(input: {
  noticeCategory: string;
  taxType: string;
  responseDueDate: string;
  amountDue?: number;
}) {
  const daysUntilDue = computeDaysUntilDue(input.responseDueDate);
  const isDanielCategory = DANIEL_CATEGORIES.has(input.noticeCategory);
  const isDanielTaxType = DANIEL_TAX_TYPES.has(input.taxType);
  const isHighDollar = (input.amountDue ?? 0) >= HIGH_DOLLAR_THRESHOLD;

  const danielReviewRequired = isDanielCategory || isDanielTaxType || isHighDollar;

  let priority: string;
  if (daysUntilDue <= 14 || isDanielCategory || isDanielTaxType || isHighDollar) {
    priority = 'High';
  } else if (['CP2000', 'Penalty', 'Missing Form'].includes(input.noticeCategory)) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  const assignedOwner = danielReviewRequired ? 'Daniel' : 'Genesis';

  return { priority, assignedOwner, danielReviewRequired };
}

type NoticeRow = typeof taxNotices.$inferSelect;

function mapRowToNotice(row: NoticeRow) {
  return {
    id: row.id,
    createdTime: row.createdAt.toISOString(),
    clientName: row.clientName || '',
    entityName: row.entityName || '',
    noticeAgency: row.noticeAgency || '',
    noticeNumber: row.noticeNumber || '',
    taxYear: row.taxYear || '',
    taxType: row.taxType || '',
    dateReceived: row.dateReceived || '',
    responseDueDate: row.responseDueDate || '',
    amountDue: row.amountDue != null ? Number(row.amountDue) : null,
    noticeCategory: row.noticeCategory || '',
    assignedOwner: row.assignedOwner || '',
    supportingTeamMember: row.supportingTeamMember || '',
    status: row.status || 'New Notice',
    priority: row.priority || 'Medium',
    danielReviewRequired: row.danielReviewRequired || false,
    clientDocumentsNeeded: row.clientDocumentsNeeded || '',
    responseFiledDate: row.responseFiledDate || '',
    proofOfSubmissionUploaded: row.proofOfSubmissionUploaded || false,
    finalResolution: row.finalResolution || '',
    createdBy: row.createdBy || '',
    letterDriveId: row.letterDriveId || null,
    letterViewUrl: row.letterViewUrl || null,
    letterFileName: row.letterFileName || null,
    responseSentToClientDate: row.responseSentToClientDate || '',
    clientSignatureDate: row.clientSignatureDate || '',
    responseSentToAgencyDate: row.responseSentToAgencyDate || '',
    responseSubmissionMethod: row.responseSubmissionMethod || '',
  };
}

const withDaysUntilDue = (row: NoticeRow) => ({
  ...mapRowToNotice(row),
  daysUntilDue: computeDaysUntilDue(row.responseDueDate || ''),
});

const TERMINAL_STATUSES = ['Submitted', 'Waiting on Agency', 'Resolved', 'Closed / Archived'] as const;

// GET /api/tax-notices/review-queue — must be registered before /:id
app.get('/review-queue', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(taxNotices)
      .where(
        and(
          eq(taxNotices.danielReviewRequired, true),
          or(
            eq(taxNotices.status, 'Needs Daniel Review'),
            not(inArray(taxNotices.status, [...TERMINAL_STATUSES]))
          )
        )
      )
      .orderBy(sql`${taxNotices.responseDueDate} ASC NULLS FIRST`);

    const notices = rows.map(withDaysUntilDue);

    return c.json({ success: true, data: notices, count: notices.length });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch review queue' },
      500
    );
  }
});

// GET /api/tax-notices/deadline-monitor — must be registered before /:id
app.get('/deadline-monitor', async (c) => {
  try {
    const rows = await getDb()
      .select()
      .from(taxNotices)
      .where(
        and(
          not(inArray(taxNotices.status, [...TERMINAL_STATUSES])),
          isNotNull(taxNotices.responseDueDate),
          ne(taxNotices.responseDueDate, '')
        )
      )
      .orderBy(sql`${taxNotices.responseDueDate} ASC NULLS FIRST`);

    const notices = rows.map(withDaysUntilDue);

    return c.json({ success: true, data: notices, count: notices.length });
  } catch (error) {
    console.error('Error fetching deadline monitor:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch deadline monitor' },
      500
    );
  }
});

// GET /api/tax-notices
app.get('/', async (c) => {
  try {
    const { status, priority, assignedOwner, agency, search, danielReviewRequired } = c.req.query();

    const conditions = [];

    if (status) {
      const list = status.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length > 0) {
        conditions.push(inArray(taxNotices.status, list as NoticeRow['status'][]));
      }
    }

    if (priority) conditions.push(eq(taxNotices.priority, priority));
    if (assignedOwner) conditions.push(eq(taxNotices.assignedOwner, assignedOwner));
    if (agency) conditions.push(eq(taxNotices.noticeAgency, agency));
    if (danielReviewRequired === 'true') conditions.push(eq(taxNotices.danielReviewRequired, true));

    if (search) {
      conditions.push(
        or(
          ilike(taxNotices.clientName, `%${search}%`),
          ilike(taxNotices.noticeNumber, `%${search}%`)
        )
      );
    }

    const rows = await getDb()
      .select()
      .from(taxNotices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${taxNotices.responseDueDate} ASC NULLS FIRST`);

    const notices = rows.map(withDaysUntilDue);

    return c.json({ success: true, data: notices, count: notices.length });
  } catch (error) {
    console.error('Error fetching tax notices:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tax notices' },
      500
    );
  }
});

// POST /api/tax-notices
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      clientName, entityName, noticeAgency, noticeNumber, noticeCategory,
      taxYear, taxType, dateReceived, responseDueDate, amountDue, createdBy,
    } = body;

    if (!clientName || !noticeAgency || !noticeNumber || !noticeCategory || !taxType || !dateReceived || !responseDueDate) {
      return c.json(
        { success: false, error: 'Missing required fields: clientName, noticeAgency, noticeNumber, noticeCategory, taxType, dateReceived, responseDueDate' },
        400
      );
    }

    const triage = autoTriage({ noticeCategory, taxType, responseDueDate, amountDue });

    const [row] = await getDb()
      .insert(taxNotices)
      .values({
        clientName,
        noticeAgency,
        noticeNumber,
        noticeCategory,
        taxType,
        dateReceived,
        responseDueDate,
        status: 'New Notice',
        priority: triage.priority,
        assignedOwner: triage.assignedOwner,
        danielReviewRequired: triage.danielReviewRequired,
        entityName: entityName || null,
        taxYear: taxYear || null,
        amountDue: amountDue !== undefined && amountDue !== null ? String(Number(amountDue)) : null,
        createdBy: createdBy || null,
      })
      .returning();

    return c.json({ success: true, data: mapRowToNotice(row), triage });
  } catch (error) {
    console.error('Error creating tax notice:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create tax notice' },
      500
    );
  }
});

// POST /api/tax-notices/:id/letter — upload the notice letter to Google Drive
app.post('/:id/letter', async (c) => {
  try {
    const id = c.req.param('id');
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return c.json({ success: false, error: 'No file provided' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId, webViewLink } = await uploadTaxNoticeLetter(buffer, file.name, file.type || 'application/octet-stream', id);

    const [row] = await getDb()
      .update(taxNotices)
      .set({
        letterDriveId: fileId,
        letterViewUrl: webViewLink,
        letterFileName: file.name,
      })
      .where(eq(taxNotices.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);

    const notice = mapRowToNotice(row);
    return c.json({ success: true, data: { ...notice, validNextStatuses: STATUS_TRANSITIONS[notice.status] || [] } });
  } catch (error) {
    console.error('Error uploading notice letter:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
});

// GET /api/tax-notices/:id/letter/download — proxy-download the letter from Google Drive
app.get('/:id/letter/download', async (c) => {
  try {
    const id = c.req.param('id');
    const [row] = await getDb().select().from(taxNotices).where(eq(taxNotices.id, id)).limit(1);

    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);
    if (!row.letterDriveId) return c.json({ success: false, error: 'No letter attached to this notice' }, 404);

    const metadata = await getFileMetadata(row.letterDriveId);
    const buffer = await downloadFileFromGoogleDrive(row.letterDriveId);

    c.header('Content-Type', (metadata.mimeType as string) || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(row.letterFileName || 'notice-letter')}"`);
    c.header('Content-Length', buffer.length.toString());
    return c.body(buffer);
  } catch (error) {
    console.error('Error downloading notice letter:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Download failed' }, 500);
  }
});

// DELETE /api/tax-notices/:id/letter — remove the letter from Drive and clear fields
app.delete('/:id/letter', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDb();
    const [row] = await db.select().from(taxNotices).where(eq(taxNotices.id, id)).limit(1);

    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);

    if (row.letterDriveId) {
      try { await deleteFileFromGoogleDrive(row.letterDriveId); } catch { /* file may already be gone */ }
    }

    const [updated] = await db
      .update(taxNotices)
      .set({ letterDriveId: null, letterViewUrl: null, letterFileName: null })
      .where(eq(taxNotices.id, id))
      .returning();

    const notice = mapRowToNotice(updated);
    return c.json({ success: true, data: { ...notice, validNextStatuses: STATUS_TRANSITIONS[notice.status] || [] } });
  } catch (error) {
    console.error('Error removing notice letter:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Remove failed' }, 500);
  }
});

// GET /api/tax-notices/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const [row] = await getDb().select().from(taxNotices).where(eq(taxNotices.id, id)).limit(1);

    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);

    const notice = mapRowToNotice(row);

    return c.json({
      success: true,
      data: { ...notice, validNextStatuses: STATUS_TRANSITIONS[notice.status] || [] },
    });
  } catch (error) {
    console.error('Error fetching tax notice:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tax notice' },
      500
    );
  }
});

// PATCH /api/tax-notices/:id
app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const values: Partial<typeof taxNotices.$inferInsert> = {};

    if (body.clientName !== undefined) values.clientName = body.clientName;
    if (body.entityName !== undefined) values.entityName = body.entityName;
    if (body.noticeAgency !== undefined) values.noticeAgency = body.noticeAgency;
    if (body.noticeNumber !== undefined) values.noticeNumber = body.noticeNumber;
    if (body.noticeCategory !== undefined) values.noticeCategory = body.noticeCategory;
    if (body.taxYear !== undefined) values.taxYear = body.taxYear;
    if (body.taxType !== undefined) values.taxType = body.taxType;
    if (body.dateReceived !== undefined) values.dateReceived = body.dateReceived;
    if (body.responseDueDate !== undefined) values.responseDueDate = body.responseDueDate;
    if (body.amountDue !== undefined) values.amountDue = body.amountDue != null ? String(body.amountDue) : null;
    if (body.assignedOwner !== undefined) values.assignedOwner = body.assignedOwner || null;
    if (body.supportingTeamMember !== undefined) values.supportingTeamMember = body.supportingTeamMember || null;
    if (body.status !== undefined) values.status = body.status;
    if (body.priority !== undefined) values.priority = body.priority;
    if (body.danielReviewRequired !== undefined) values.danielReviewRequired = body.danielReviewRequired;
    if (body.clientDocumentsNeeded !== undefined) values.clientDocumentsNeeded = body.clientDocumentsNeeded;
    if (body.responseFiledDate !== undefined) values.responseFiledDate = body.responseFiledDate;
    if (body.proofOfSubmissionUploaded !== undefined) values.proofOfSubmissionUploaded = body.proofOfSubmissionUploaded;
    if (body.finalResolution !== undefined) values.finalResolution = body.finalResolution;
    if (body.responseSentToClientDate !== undefined) values.responseSentToClientDate = body.responseSentToClientDate || null;
    if (body.clientSignatureDate !== undefined) values.clientSignatureDate = body.clientSignatureDate || null;
    if (body.responseSentToAgencyDate !== undefined) values.responseSentToAgencyDate = body.responseSentToAgencyDate || null;
    if (body.responseSubmissionMethod !== undefined) values.responseSubmissionMethod = body.responseSubmissionMethod || null;

    const [row] = await getDb()
      .update(taxNotices)
      .set(values)
      .where(eq(taxNotices.id, id))
      .returning();

    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);

    const notice = mapRowToNotice(row);

    return c.json({
      success: true,
      data: { ...notice, validNextStatuses: STATUS_TRANSITIONS[notice.status] || [] },
    });
  } catch (error) {
    console.error('Error updating tax notice:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update tax notice' },
      500
    );
  }
});

// POST /api/tax-notices/:id/advance-status
app.post('/:id/advance-status', async (c) => {
  try {
    const id = c.req.param('id');
    const { targetStatus } = await c.req.json();

    const db = getDb();
    const [row] = await db.select().from(taxNotices).where(eq(taxNotices.id, id)).limit(1);
    if (!row) return c.json({ success: false, error: 'Notice not found' }, 404);

    const notice = mapRowToNotice(row);

    const validNext = STATUS_TRANSITIONS[notice.status] || [];
    if (!validNext.includes(targetStatus)) {
      return c.json(
        { success: false, error: `Cannot transition from "${notice.status}" to "${targetStatus}". Valid transitions: ${validNext.join(', ') || 'none'}` },
        400
      );
    }

    if (targetStatus === 'Closed / Archived' && !notice.finalResolution?.trim()) {
      return c.json({ success: false, error: 'Cannot archive — Final Resolution must be filled in first.' }, 400);
    }

    if (targetStatus === 'Needs Daniel Review' && !notice.danielReviewRequired) {
      return c.json({ success: false, error: 'Daniel Review is not required for this notice.' }, 400);
    }

    if (targetStatus === 'Response Signed' && !notice.clientSignatureDate) {
      return c.json({ success: false, error: 'Cannot mark as signed — Client Signature Date must be saved first.' }, 400);
    }

    const [updated] = await db
      .update(taxNotices)
      .set({ status: targetStatus })
      .where(eq(taxNotices.id, id))
      .returning();

    const updatedNotice = mapRowToNotice(updated);

    return c.json({
      success: true,
      data: { ...updatedNotice, validNextStatuses: STATUS_TRANSITIONS[updatedNotice.status] || [] },
    });
  } catch (error) {
    console.error('Error advancing tax notice status:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to advance status' },
      500
    );
  }
});

// DELETE /api/tax-notices/:id — soft delete
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await getDb()
      .update(taxNotices)
      .set({ status: 'Closed / Archived' })
      .where(eq(taxNotices.id, id));
    return c.json({ success: true, message: 'Notice archived successfully' });
  } catch (error) {
    console.error('Error archiving tax notice:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to archive notice' },
      500
    );
  }
});

export default app;
