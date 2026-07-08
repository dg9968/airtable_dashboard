import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';
import { personal, corporations } from './people';
import { personalServices, servicesCorporate } from './catalogs';

// Airtable "Subscriptions Personal" — junction Personal ↔ Personal Services,
// doubling as the personal pipelines (Tax Prep, File Extension, ...).
// The Airtable link field to Personal was misleadingly named "Last Name".
// tax_preparer_id references the Better Auth user table (old Airtable Users
// rec IDs are remapped by email during ETL). The legacy "Processor" text and
// "Name (from Team Link)" lookups are computed in serializers from that user.
export const subscriptionsPersonal = pgTable(
  'subscriptions_personal',
  {
    id: id(),
    personalId: text('personal_id').references(() => personal.id, { onDelete: 'set null' }),
    serviceId: text('service_id').references(() => personalServices.id, { onDelete: 'set null' }),
    status: text('status'),
    notes: text('notes'),
    taxPreparerId: text('tax_preparer_id'), // Better Auth user id (no FK — auth table not in this schema)
    extensionTaxYear: integer('extension_tax_year'),
    extensionStatus: text('extension_status'),
    extensionFiledDate: text('extension_filed_date'),
    extensionEstimatedTax: numeric('extension_estimated_tax'),
    extensionPaymentsCredits: numeric('extension_payments_credits'),
    createdAt: createdAt(),
  },
  (t) => [
    index('subscriptions_personal_personal_idx').on(t.personalId),
    index('subscriptions_personal_service_idx').on(t.serviceId),
  ]
);

// Airtable "Subscriptions Corporate" — junction Corporations ↔ Services
// Corporate; also the corporate pipeline + recurring billing. Customer lookups
// (Company/EIN/etc.) are joins in serializers. processor_id is a remapped
// Better Auth user id; "Tax Preparer" here was a plain text name in Airtable.
export const subscriptionsCorporate = pgTable(
  'subscriptions_corporate',
  {
    id: id(),
    corporationId: text('corporation_id').references(() => corporations.id, { onDelete: 'set null' }),
    serviceId: text('service_id').references(() => servicesCorporate.id, { onDelete: 'set null' }),
    status: text('status'),
    notes: text('notes'),
    processorId: text('processor_id'), // Better Auth user id
    taxPreparer: text('tax_preparer'), // legacy free-text name
    dateAssigned: text('date_assigned'),
    billingAmount: numeric('billing_amount'),
    filed: boolean('filed'),
    sendToBookkeeper: boolean('send_to_bookkeeper'),
    duration: integer('duration'),
    bookkeeperEstimate: text('bookkeeper_estimate'),
    dueDate: text('due_date'),
    // Formula snapshots from Airtable (recurrence dates; not recomputed)
    quarterlyStDate: text('quarterly_st_date'),
    monthlyStDate: text('monthly_st_date'),
    extensionTaxYear: integer('extension_tax_year'),
    extensionStatus: text('extension_status'),
    extensionFiledDate: text('extension_filed_date'),
    extensionEstimatedTax: numeric('extension_estimated_tax'),
    extensionPaymentsCredits: numeric('extension_payments_credits'),
    createdAt: createdAt(),
  },
  (t) => [
    index('subscriptions_corporate_corporation_idx').on(t.corporationId),
    index('subscriptions_corporate_service_idx').on(t.serviceId),
    index('subscriptions_corporate_status_idx').on(t.status),
  ]
);

// Airtable "Services Rendered" — completed work awaiting billing. Client/
// service/processor are stored values (not lookups) by design, so they
// survive subscription deletion at billing time.
export const servicesRendered = pgTable(
  'services_rendered',
  {
    id: id(),
    clientName: text('client_name'),
    clientType: text('client_type'), // 'personal' | 'corporate'
    billingStatus: text('billing_status'),
    serviceType: text('service_type'),
    serviceRenderedDate: text('service_rendered_date'),
    processor: text('processor'),
    amountCharged: numeric('amount_charged'),
    paymentMethod: text('payment_method'),
    receiptDate: text('receipt_date'),
    notes: text('notes'),
    subscriptionPersonalId: text('subscription_personal_id'), // no FK: subscriptions get deleted at billing
    subscriptionCorporateId: text('subscription_corporate_id'),
    ledgerEntryId: text('ledger_entry_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('services_rendered_billing_status_idx').on(t.billingStatus),
    index('services_rendered_date_idx').on(t.serviceRenderedDate),
  ]
);

// Airtable "Ledger" — paid-revenue entries. Client/service stored as text
// (survives subscription deletion). receipt_date keeps Airtable's mixed
// date / ISO-datetime strings verbatim.
export const ledger = pgTable(
  'ledger',
  {
    id: id(),
    serviceRendered: text('service_rendered'),
    receiptDate: text('receipt_date'),
    amountCharged: numeric('amount_charged'),
    nameOfClient: text('name_of_client'),
    paymentMethod: text('payment_method'),
    subscriptionPersonalId: text('subscription_personal_id'),
    subscriptionCorporateId: text('subscription_corporate_id'),
    createdAt: createdAt(),
  },
  (t) => [index('ledger_receipt_date_idx').on(t.receiptDate)]
);

// Note tables — same shape, different parent.
export const pipelineNotes = pgTable(
  'pipeline_notes',
  {
    id: id(),
    subscriptionPersonalId: text('subscription_personal_id').references(
      () => subscriptionsPersonal.id,
      { onDelete: 'set null' }
    ),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('pipeline_notes_subscription_idx').on(t.subscriptionPersonalId)]
);

export const corporatePipelineNotes = pgTable(
  'corporate_pipeline_notes',
  {
    id: id(),
    subscriptionCorporateId: text('subscription_corporate_id').references(
      () => subscriptionsCorporate.id,
      { onDelete: 'set null' }
    ),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('corporate_pipeline_notes_subscription_idx').on(t.subscriptionCorporateId)]
);

export const billingNotes = pgTable(
  'billing_notes',
  {
    id: id(),
    servicesRenderedId: text('services_rendered_id').references(() => servicesRendered.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('billing_notes_services_rendered_idx').on(t.servicesRenderedId)]
);
