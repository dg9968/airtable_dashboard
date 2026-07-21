/**
 * Compat serializers for the subscription/billing domain: rebuild legacy
 * Airtable record shapes (including lookup fields like the double-space
 * 'Company  (from Customer)') from Postgres rows.
 *
 * Context loaders bulk-fetch the joined data once per request so list
 * endpoints don't N+1.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import {
  personal,
  corporations,
  personalServices,
  servicesCorporate,
  personalPipelineTickets,
  corporatePipelineTickets,
  corporateBillingBundleItems,
  billingRecords,
  pipelineNotes,
  corporatePipelineNotes,
} from './schema';
import { authUser } from './auth-readonly';
import type { AirtableShapedRecord } from './serializers';

type SubsPersonalRow = typeof personalPipelineTickets.$inferSelect;
type SubsCorporateRow = typeof corporatePipelineTickets.$inferSelect;
type BillingRecordRow = typeof billingRecords.$inferSelect;

function put(fields: Record<string, unknown>, name: string, value: unknown) {
  if (value === null || value === undefined || value === '') return;
  if (Array.isArray(value) && value.length === 0) return;
  fields[name] = value;
}

interface UserInfo {
  name: string;
  email: string;
}

async function loadUsers(db: NodePgDatabase<typeof schema>): Promise<Map<string, UserInfo>> {
  const rows = await db.select({ id: authUser.id, name: authUser.name, email: authUser.email }).from(authUser);
  return new Map(rows.map((u) => [u.id, { name: u.name, email: u.email }]));
}

// ---------------------------------------------------------------------------
// Subscriptions Personal (personal pipeline tickets)
// ---------------------------------------------------------------------------

export interface SubsPersonalContext {
  persons: Map<string, { fullName: string; clientCode: string | null; email: string | null; phone: string | null }>;
  serviceNames: Map<string, string>;
  users: Map<string, UserInfo>;
  noteIds: Map<string, string[]>;
}

export async function loadSubsPersonalContext(
  db: NodePgDatabase<typeof schema>
): Promise<SubsPersonalContext> {
  const [personRows, serviceRows, users, noteRows] = await Promise.all([
    db.select({
      id: personal.id,
      firstName: personal.firstName,
      lastName: personal.lastName,
      clientCode: personal.clientCode,
      email: personal.email,
      phone: personal.phone,
    }).from(personal),
    db.select({ id: personalServices.id, name: personalServices.name }).from(personalServices),
    loadUsers(db),
    db.select({
      id: pipelineNotes.id,
      subscriptionPersonalId: pipelineNotes.subscriptionPersonalId,
    }).from(pipelineNotes),
  ]);

  const persons = new Map(
    personRows.map((p) => [
      p.id,
      {
        fullName: [p.firstName, p.lastName].filter(Boolean).join(' '),
        clientCode: p.clientCode,
        email: p.email,
        phone: p.phone,
      },
    ])
  );
  const serviceNames = new Map(serviceRows.map((s) => [s.id, s.name]));
  const noteIds = new Map<string, string[]>();
  for (const n of noteRows) {
    if (!n.subscriptionPersonalId) continue;
    const list = noteIds.get(n.subscriptionPersonalId) ?? [];
    list.push(n.id);
    noteIds.set(n.subscriptionPersonalId, list);
  }

  return { persons, serviceNames, users, noteIds };
}

export function subsPersonalToAirtableRecord(
  row: SubsPersonalRow,
  ctx: SubsPersonalContext
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};
  const person = row.personalId ? ctx.persons.get(row.personalId) : undefined;
  const serviceName = row.serviceId ? ctx.serviceNames.get(row.serviceId) : undefined;
  const preparer = row.taxPreparerId ? ctx.users.get(row.taxPreparerId) : undefined;

  put(fields, 'Name', `${person?.fullName ?? ''} - ${serviceName ?? ''}`.trim() === '-' ? null : `${person?.fullName ?? ''} - ${serviceName ?? ''}`);
  put(fields, 'Last Name', row.personalId ? [row.personalId] : null);
  put(fields, 'Full Name', person?.fullName ? [person.fullName] : null);
  put(fields, 'Client Code', person?.clientCode ? [person.clientCode] : null);
  put(fields, '📧 Email', person?.email ? [person.email] : null);
  put(fields, '📞Phone number', person?.phone ? [person.phone] : null);
  put(fields, 'Service', row.serviceId ? [row.serviceId] : null);
  put(fields, 'Service Name (from Service)', serviceName ? [serviceName] : null);
  put(fields, 'Status', row.status);
  put(fields, 'Notes', row.notes);
  put(fields, 'Tax Preparer', row.taxPreparerId ? [row.taxPreparerId] : null);
  put(fields, 'Processor', preparer?.name ?? null);
  put(fields, 'Name (from Team Link)', preparer?.name ? [preparer.name] : null);
  put(fields, 'Tax Preparer Email', preparer?.email ? [preparer.email] : null);
  put(fields, 'Extension Tax Year', row.extensionTaxYear);
  put(fields, 'Extension Status', row.extensionStatus);
  put(fields, 'Extension Filed Date', row.extensionFiledDate);
  put(fields, 'Extension Estimated Tax', row.extensionEstimatedTax != null ? Number(row.extensionEstimatedTax) : null);
  put(fields, 'Extension Payments Credits', row.extensionPaymentsCredits != null ? Number(row.extensionPaymentsCredits) : null);
  put(fields, 'Pipeline Notes', ctx.noteIds.get(row.id) ?? null);

  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

/** Legacy field names → subscriptions_personal columns for PATCH bodies. */
export function subsPersonalFieldsToColumns(
  fields: Record<string, unknown>
): Partial<typeof personalPipelineTickets.$inferInsert> {
  const out: Partial<typeof personalPipelineTickets.$inferInsert> = {};
  const first = (v: unknown) => (Array.isArray(v) ? (v[0] as string | undefined) ?? null : (v as string | null));

  for (const [key, value] of Object.entries(fields)) {
    switch (key) {
      case 'Last Name': out.personalId = first(value); break;
      case 'Service': out.serviceId = first(value); break;
      case 'Status': out.status = value === null || (Array.isArray(value) && value.length === 0) ? null : first(value); break;
      case 'Notes': out.notes = (value as string) || null; break;
      case 'Tax Preparer': out.taxPreparerId = first(value); break;
      case 'Extension Tax Year': out.extensionTaxYear = value == null ? null : Number(value); break;
      case 'Extension Status': out.extensionStatus = (value as string) || null; break;
      case 'Extension Filed Date': out.extensionFiledDate = (value as string) || null; break;
      case 'Extension Estimated Tax': out.extensionEstimatedTax = value == null ? null : String(value); break;
      case 'Extension Payments Credits': out.extensionPaymentsCredits = value == null ? null : String(value); break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Subscriptions Corporate (corporate pipeline tickets)
// ---------------------------------------------------------------------------

export interface SubsCorporateContext {
  corps: Map<string, typeof corporations.$inferSelect>;
  serviceNames: Map<string, string>;
  users: Map<string, UserInfo>;
  noteIds: Map<string, string[]>;
  ledgerIds: Map<string, string[]>;
  // bundle_item_id -> current amount, so the legacy "Billing Amount" field can
  // be reconstructed for tickets whose service is covered by the client's bundle.
  bundleItemAmounts: Map<string, number>;
}

export async function loadSubsCorporateContext(
  db: NodePgDatabase<typeof schema>
): Promise<SubsCorporateContext> {
  const [corpRows, serviceRows, users, noteRows, billingRecordRows, bundleItemRows] = await Promise.all([
    db.select().from(corporations),
    db.select({ id: servicesCorporate.id, name: servicesCorporate.name }).from(servicesCorporate),
    loadUsers(db),
    db.select({
      id: corporatePipelineNotes.id,
      subscriptionCorporateId: corporatePipelineNotes.subscriptionCorporateId,
    }).from(corporatePipelineNotes),
    db.select({
      id: billingRecords.id,
      subscriptionCorporateId: billingRecords.subscriptionCorporateId,
    }).from(billingRecords),
    db.select({ id: corporateBillingBundleItems.id, amount: corporateBillingBundleItems.amount }).from(corporateBillingBundleItems),
  ]);

  const noteIds = new Map<string, string[]>();
  for (const n of noteRows) {
    if (!n.subscriptionCorporateId) continue;
    const list = noteIds.get(n.subscriptionCorporateId) ?? [];
    list.push(n.id);
    noteIds.set(n.subscriptionCorporateId, list);
  }
  const ledgerIds = new Map<string, string[]>();
  for (const b of billingRecordRows) {
    if (!b.subscriptionCorporateId) continue;
    const list = ledgerIds.get(b.subscriptionCorporateId) ?? [];
    list.push(b.id);
    ledgerIds.set(b.subscriptionCorporateId, list);
  }

  return {
    corps: new Map(corpRows.map((c) => [c.id, c])),
    serviceNames: new Map(serviceRows.map((s) => [s.id, s.name])),
    users,
    noteIds,
    ledgerIds,
    bundleItemAmounts: new Map(bundleItemRows.map((b) => [b.id, Number(b.amount)])),
  };
}

export function subsCorporateToAirtableRecord(
  row: SubsCorporateRow,
  ctx: SubsCorporateContext
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};
  const corp = row.corporationId ? ctx.corps.get(row.corporationId) : undefined;
  const serviceName = row.serviceId ? ctx.serviceNames.get(row.serviceId) : undefined;
  const processor = row.processorId ? ctx.users.get(row.processorId) : undefined;

  put(fields, 'Name', `${corp?.company ?? ''} - ${serviceName ?? ''}`.trim() === '-' ? null : `${corp?.company ?? ''} - ${serviceName ?? ''}`);
  put(fields, 'Customer', row.corporationId ? [row.corporationId] : null);
  put(fields, 'Company  (from Customer)', corp?.company ? [corp.company] : null); // double space preserved
  put(
    fields,
    'Registered Agent (from Customer)',
    corp?.registeredAgent ? [{ state: 'generated', value: corp.registeredAgent, isStale: false }] : null
  );
  put(fields, 'EIN (from Customer)', corp?.ein ? [corp.ein] : null);
  put(fields, 'Sunbiz Document Number (from Customer)', corp?.sunbizDocumentNumber ? [corp.sunbizDocumentNumber] : null);
  put(fields, 'Language Preference', corp?.languagePreference ? [corp.languagePreference] : null);
  put(fields, 'Email', corp?.email ? [corp.email] : null);
  put(fields, 'Phone', corp?.phone ? [corp.phone] : null);
  put(fields, 'Contact', corp?.contact ? [corp.contact] : null);
  put(
    fields,
    'Business Partner Number (from Customer)',
    corp?.businessPartnerNumbers?.map((n) => (isNaN(Number(n)) ? n : Number(n))) ?? null
  );
  put(fields, 'ST Certificate (from Customer)', corp?.stCertificateValues ?? null);
  put(fields, 'Services', row.serviceId ? [row.serviceId] : null);
  put(fields, 'Service Name', serviceName ? [serviceName] : null);
  put(fields, 'Status', row.status);
  put(fields, 'Notes', row.notes);
  put(fields, 'Processor', row.processorId ? [row.processorId] : null);
  put(fields, 'Name (from Processor)', processor?.name ? [processor.name] : null);
  put(fields, 'Email (from Processor)', processor?.email ? [processor.email] : null);
  put(fields, 'Tax Preparer', row.taxPreparer);
  put(fields, 'Date Assigned', row.dateAssigned);
  // Recurring billing amount now lives on the client's bundle line item, not
  // on the ticket itself — reconstruct the legacy "Billing Amount" field by
  // joining through bundle_item_id for tickets covered by a bundle. (The
  // billingAmount column itself is deprecated and no longer read.)
  put(fields, 'Billing Amount', row.bundleItemId ? ctx.bundleItemAmounts.get(row.bundleItemId) ?? null : null);
  put(fields, 'Bundle Item', row.bundleItemId ? [row.bundleItemId] : null);
  put(fields, 'Filed', row.filed || null);
  put(fields, 'Send to Bookkeeper', row.sendToBookkeeper || null);
  put(fields, 'Duration', row.duration);
  put(fields, 'Bookkeeper Estimate', row.bookkeeperEstimate);
  put(fields, 'Due Date', row.dueDate);
  put(fields, 'Quarterly ST Date', row.quarterlyStDate);
  put(fields, 'Monthly ST Date', row.monthlyStDate);
  put(fields, 'Extension Tax Year', row.extensionTaxYear);
  put(fields, 'Extension Status', row.extensionStatus);
  put(fields, 'Extension Filed Date', row.extensionFiledDate);
  put(fields, 'Extension Estimated Tax', row.extensionEstimatedTax != null ? Number(row.extensionEstimatedTax) : null);
  put(fields, 'Extension Payments Credits', row.extensionPaymentsCredits != null ? Number(row.extensionPaymentsCredits) : null);
  put(fields, 'ledger', ctx.ledgerIds.get(row.id) ?? null);
  put(fields, 'Corporate Pipeline Notes', ctx.noteIds.get(row.id) ?? null);

  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

/** Legacy field names → subscriptions_corporate columns for PATCH bodies. */
export function subsCorporateFieldsToColumns(
  fields: Record<string, unknown>
): Partial<typeof corporatePipelineTickets.$inferInsert> {
  const out: Partial<typeof corporatePipelineTickets.$inferInsert> = {};
  const first = (v: unknown) => (Array.isArray(v) ? (v[0] as string | undefined) ?? null : (v as string | null));

  for (const [key, value] of Object.entries(fields)) {
    switch (key) {
      case 'Customer': out.corporationId = first(value); break;
      case 'Services': out.serviceId = first(value); break;
      case 'Status': out.status = value === null || (Array.isArray(value) && value.length === 0) ? null : first(value); break;
      case 'Notes': out.notes = (value as string) || null; break;
      case 'Processor': out.processorId = first(value); break;
      case 'Tax Preparer': out.taxPreparer = (value as string) || null; break;
      case 'Date Assigned': out.dateAssigned = (value as string) || null; break;
      case 'Bundle Item': out.bundleItemId = first(value); break;
      case 'Filed': out.filed = Boolean(value); break;
      case 'Send to Bookkeeper': out.sendToBookkeeper = Boolean(value); break;
      case 'Duration': out.duration = value == null ? null : Number(value); break;
      case 'Bookkeeper Estimate': out.bookkeeperEstimate = (value as string) || null; break;
      case 'Due Date': out.dueDate = (value as string) || null; break;
      case 'Extension Tax Year': out.extensionTaxYear = value == null ? null : Number(value); break;
      case 'Extension Status': out.extensionStatus = (value as string) || null; break;
      case 'Extension Filed Date': out.extensionFiledDate = (value as string) || null; break;
      case 'Extension Estimated Tax': out.extensionEstimatedTax = value == null ? null : String(value); break;
      case 'Extension Payments Credits': out.extensionPaymentsCredits = value == null ? null : String(value); break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Billing Records (Services Rendered — now also "the ledger") / Notes
// ---------------------------------------------------------------------------

// Legacy Airtable "Billing Status" values are used as-is. 'Part of
// Subscription' is replaced going forward by 'Covered by Bundle' — the only
// vocabulary change; existing historical rows using other values are
// unaffected and keep displaying correctly.
export const WIRE_BILLING_STATUSES = ['Unbilled', 'Billed - Unpaid', 'Billed - Paid', 'Waived', 'Covered by Bundle'];

export function billingRecordToAirtableRecord(
  row: BillingRecordRow,
  billingNoteIds?: string[]
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};
  put(fields, 'Client Name', row.clientName);
  put(fields, 'Client Type', row.clientType);
  put(fields, 'Created Time', row.createdAt.toISOString());
  put(fields, 'Billing Status', row.billingStatus);
  put(fields, 'Service Type', row.serviceType);
  put(fields, 'Service Rendered Date', row.serviceRenderedDate);
  put(fields, 'Processor', row.processor);
  put(fields, 'Amount Charged', row.amountCharged != null ? Number(row.amountCharged) : null);
  put(fields, 'Payment Method', row.paymentMethod);
  put(fields, 'Receipt Date', row.receiptDate);
  put(fields, 'Notes', row.notes);
  put(fields, 'Subscription Personal', row.subscriptionPersonalId ? [row.subscriptionPersonalId] : null);
  put(fields, 'Subscription Corporate', row.subscriptionCorporateId ? [row.subscriptionCorporateId] : null);
  put(fields, 'Billing Notes', billingNoteIds ?? null);

  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

type NoteRow = { id: string; authorName: string | null; authorEmail: string | null; note: string | null; createdAt: Date };

export function noteToAirtableRecord(
  row: NoteRow,
  parentField: 'Subscription' | 'Services Rendered',
  parentId: string | null,
  extra?: { name: 'Client Name' | 'Company Name'; value: string | null }
): AirtableShapedRecord {
  const fields: Record<string, unknown> = {};
  put(fields, parentField, parentId ? [parentId] : null);
  put(fields, 'Author Name', row.authorName);
  put(fields, 'Author Email', row.authorEmail);
  put(fields, 'Note', row.note);
  put(fields, 'Created Time', row.createdAt.toISOString());
  if (extra) put(fields, extra.name, extra.value ? [extra.value] : null);

  return { id: row.id, createdTime: row.createdAt.toISOString(), fields };
}

// View-name → filter mapping, reverse-engineered empirically from the live
// Airtable views (see Phase 3 migration notes). Values are exact service
// names; null means "no filter" (view showed the whole table).
export const CORPORATE_VIEW_FILTERS: Record<string, { serviceName: string; activeOnly?: boolean } | null> = {
  'Reconciling Banks for Tax Prep': { serviceName: 'Reconciling Banks for Tax Prep' },
  'Tax Returns': { serviceName: 'Tax Returns' },
  'Payroll': { serviceName: 'Payroll' },
  'Annual Report': { serviceName: 'Annual Report' },
  'Monthly Sales Tax': { serviceName: 'Sales Tax Monthly' },
  'Quarterly Sales Tax': { serviceName: 'Sales Tax Quarterly' },
  'Registered Agent': { serviceName: 'Registered Agent' },
  '1099 Filing': { serviceName: '1099 Filing' },
  'Corporate Cases': { serviceName: 'Corporate Cases' },
  'Extensions': { serviceName: 'Extensions' },
  'Bookkeeping': { serviceName: 'Bookkeeping Clients' },
  'Bookkeeping Billing': { serviceName: 'Bookkeeping Clients', activeOnly: true },
  'Services by Client All': null,
  'Grid view': null,
};

export const PERSONAL_VIEW_FILTERS: Record<string, { serviceName: string } | null> = {
  'Tax Prep Pipeline': { serviceName: 'Tax Prep Pipeline' },
  'Tax Planning': { serviceName: 'Tax Planning' },
  'IRS Resolution': { serviceName: 'IRS Resolution' },
  // The Airtable 'Amended Returns' view was unfiltered (showed all 233 records);
  // preserved as-is to keep UI behavior identical.
  'Amended Returns': null,
  'Prior Year Returns': { serviceName: 'Prior Year Returns' },
  'File Extension': { serviceName: 'File Extension' },
  'Grid view': null,
};
