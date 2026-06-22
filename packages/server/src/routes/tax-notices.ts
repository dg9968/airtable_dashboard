import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, getRecord } from '../lib/airtable-helpers';

const app = new Hono();
const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TABLE = 'Tax Notices';
const HIGH_DOLLAR_THRESHOLD = 2000;

const DANIEL_CATEGORIES = new Set(['Audit', 'Collections', 'Levy/Lien', 'Garnishment', 'Appeal']);
const DANIEL_TAX_TYPES = new Set(['Business', 'Payroll']);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  'New Notice': ['Scanned / Uploaded'],
  'Scanned / Uploaded': ['Initial Review'],
  'Initial Review': ['Waiting on Client', 'Research / Drafting'],
  'Waiting on Client': ['Research / Drafting'],
  'Research / Drafting': ['Needs Daniel Review', 'Ready to Submit'],
  'Needs Daniel Review': ['Ready to Submit'],
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

function mapRecordToNotice(record: any) {
  return {
    id: record.id,
    createdTime: record.createdTime,
    clientName: record.fields['Client Name'] || '',
    entityName: record.fields['Entity Name'] || '',
    noticeAgency: record.fields['Notice Agency'] || '',
    noticeNumber: record.fields['Notice Number'] || '',
    taxYear: record.fields['Tax Year'] || '',
    taxType: record.fields['Tax Type'] || '',
    dateReceived: record.fields['Date Received'] || '',
    responseDueDate: record.fields['Response Due Date'] || '',
    amountDue: record.fields['Amount Due'] ?? null,
    noticeCategory: record.fields['Notice Category'] || '',
    assignedOwner: record.fields['Assigned Owner'] || '',
    supportingTeamMember: record.fields['Supporting Team Member'] || '',
    status: record.fields['Status'] || 'New Notice',
    priority: record.fields['Priority'] || 'Medium',
    danielReviewRequired: record.fields['Daniel Review Required'] || false,
    clientDocumentsNeeded: record.fields['Client Documents Needed'] || '',
    responseFiledDate: record.fields['Response Filed Date'] || '',
    proofOfSubmissionUploaded: record.fields['Proof of Submission Uploaded'] || false,
    finalResolution: record.fields['Final Resolution'] || '',
    createdBy: record.fields['Created By'] || '',
  };
}

// GET /api/tax-notices/review-queue — must be registered before /:id
app.get('/review-queue', async (c) => {
  try {
    const records = await fetchAllRecords(BASE_ID, TABLE, {
      filterByFormula: `AND({Daniel Review Required} = TRUE(), OR({Status} = 'Needs Daniel Review', AND({Status} != 'Submitted', {Status} != 'Waiting on Agency', {Status} != 'Resolved', {Status} != 'Closed / Archived')))`,
      sort: [{ field: 'Response Due Date', direction: 'asc' }],
    });

    const notices = records.map(r => ({
      ...mapRecordToNotice(r),
      daysUntilDue: computeDaysUntilDue(r.fields['Response Due Date'] || ''),
    }));

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
    const excluded = ['Submitted', 'Waiting on Agency', 'Resolved', 'Closed / Archived'];
    const excludeFormula = excluded.map(s => `{Status} != '${s}'`).join(', ');

    const records = await fetchAllRecords(BASE_ID, TABLE, {
      filterByFormula: `AND(${excludeFormula}, {Response Due Date} != '')`,
      sort: [{ field: 'Response Due Date', direction: 'asc' }],
    });

    const notices = records.map(r => ({
      ...mapRecordToNotice(r),
      daysUntilDue: computeDaysUntilDue(r.fields['Response Due Date'] || ''),
    }));

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

    const filters: string[] = [];

    if (status) {
      const list = status.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length === 1) {
        filters.push(`{Status} = '${list[0]}'`);
      } else if (list.length > 1) {
        filters.push(`OR(${list.map(s => `{Status} = '${s}'`).join(', ')})`);
      }
    }

    if (priority) filters.push(`{Priority} = '${priority}'`);
    if (assignedOwner) filters.push(`{Assigned Owner} = '${assignedOwner}'`);
    if (agency) filters.push(`{Notice Agency} = '${agency}'`);
    if (danielReviewRequired === 'true') filters.push(`{Daniel Review Required} = TRUE()`);

    if (search) {
      const s = search.replace(/'/g, "\\'");
      filters.push(`OR(FIND(LOWER('${s}'), LOWER({Client Name})), FIND(LOWER('${s}'), LOWER({Notice Number})))`);
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    const records = await fetchAllRecords(BASE_ID, TABLE, {
      filterByFormula,
      sort: [{ field: 'Response Due Date', direction: 'asc' }],
    });

    const notices = records.map(r => ({
      ...mapRecordToNotice(r),
      daysUntilDue: computeDaysUntilDue(r.fields['Response Due Date'] || ''),
    }));

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

    const fields: Record<string, any> = {
      'Client Name': clientName,
      'Notice Agency': noticeAgency,
      'Notice Number': noticeNumber,
      'Notice Category': noticeCategory,
      'Tax Type': taxType,
      'Date Received': dateReceived,
      'Response Due Date': responseDueDate,
      'Status': 'New Notice',
      'Priority': triage.priority,
      'Assigned Owner': triage.assignedOwner,
      'Daniel Review Required': triage.danielReviewRequired,
    };

    if (entityName) fields['Entity Name'] = entityName;
    if (taxYear) fields['Tax Year'] = taxYear;
    if (amountDue !== undefined && amountDue !== null) fields['Amount Due'] = Number(amountDue);
    if (createdBy) fields['Created By'] = createdBy;

    const records = await createRecords(BASE_ID, TABLE, [{ fields }]);
    const notice = mapRecordToNotice(records[0]);

    return c.json({ success: true, data: notice, triage });
  } catch (error) {
    console.error('Error creating tax notice:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create tax notice' },
      500
    );
  }
});

// GET /api/tax-notices/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await getRecord(BASE_ID, TABLE, id);
    const notice = mapRecordToNotice(record);

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
    const fields: Record<string, any> = {};

    if (body.clientName !== undefined) fields['Client Name'] = body.clientName;
    if (body.entityName !== undefined) fields['Entity Name'] = body.entityName;
    if (body.noticeAgency !== undefined) fields['Notice Agency'] = body.noticeAgency;
    if (body.noticeNumber !== undefined) fields['Notice Number'] = body.noticeNumber;
    if (body.noticeCategory !== undefined) fields['Notice Category'] = body.noticeCategory;
    if (body.taxYear !== undefined) fields['Tax Year'] = body.taxYear;
    if (body.taxType !== undefined) fields['Tax Type'] = body.taxType;
    if (body.dateReceived !== undefined) fields['Date Received'] = body.dateReceived;
    if (body.responseDueDate !== undefined) fields['Response Due Date'] = body.responseDueDate;
    if (body.amountDue !== undefined) fields['Amount Due'] = body.amountDue;
    if (body.assignedOwner !== undefined) fields['Assigned Owner'] = body.assignedOwner;
    if (body.supportingTeamMember !== undefined) fields['Supporting Team Member'] = body.supportingTeamMember;
    if (body.status !== undefined) fields['Status'] = body.status;
    if (body.priority !== undefined) fields['Priority'] = body.priority;
    if (body.danielReviewRequired !== undefined) fields['Daniel Review Required'] = body.danielReviewRequired;
    if (body.clientDocumentsNeeded !== undefined) fields['Client Documents Needed'] = body.clientDocumentsNeeded;
    if (body.responseFiledDate !== undefined) fields['Response Filed Date'] = body.responseFiledDate;
    if (body.proofOfSubmissionUploaded !== undefined) fields['Proof of Submission Uploaded'] = body.proofOfSubmissionUploaded;
    if (body.finalResolution !== undefined) fields['Final Resolution'] = body.finalResolution;

    const records = await updateRecords(BASE_ID, TABLE, [{ id, fields }]);
    const notice = mapRecordToNotice(records[0]);

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

    const record = await getRecord(BASE_ID, TABLE, id);
    const notice = mapRecordToNotice(record);

    const validNext = STATUS_TRANSITIONS[notice.status] || [];
    if (!validNext.includes(targetStatus)) {
      return c.json(
        { success: false, error: `Cannot transition from "${notice.status}" to "${targetStatus}". Valid transitions: ${validNext.join(', ') || 'none'}` },
        400
      );
    }

    if (targetStatus === 'Submitted') {
      if (!notice.responseFiledDate) {
        return c.json({ success: false, error: 'Cannot submit — Response Filed Date must be set first.' }, 400);
      }
      if (!notice.proofOfSubmissionUploaded) {
        return c.json({ success: false, error: 'Cannot submit — Proof of Submission must be marked as uploaded first.' }, 400);
      }
    }

    if (targetStatus === 'Closed / Archived' && !notice.finalResolution?.trim()) {
      return c.json({ success: false, error: 'Cannot archive — Final Resolution must be filled in first.' }, 400);
    }

    if (targetStatus === 'Needs Daniel Review' && !notice.danielReviewRequired) {
      return c.json({ success: false, error: 'Daniel Review is not required for this notice.' }, 400);
    }

    const updated = await updateRecords(BASE_ID, TABLE, [{ id, fields: { 'Status': targetStatus } }]);
    const updatedNotice = mapRecordToNotice(updated[0]);

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
    await updateRecords(BASE_ID, TABLE, [{ id, fields: { 'Status': 'Closed / Archived' } }]);
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
