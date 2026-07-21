import { sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';
import { personal, corporations } from './people';
import { personalServices, servicesCorporate } from './catalogs';

// Airtable "Subscriptions Personal" — junction Personal ↔ Personal Services,
// doubling as the personal work pipeline (Tax Prep, File Extension, ...).
// TS name renamed to "pipeline tickets" (physical table name unchanged): this
// row is a unit of work, never money — personal clients are billed per-
// service via billing_records, they never get a recurring billing bundle.
// The Airtable link field to Personal was misleadingly named "Last Name".
// tax_preparer_id references the Better Auth user table (old Airtable Users
// rec IDs are remapped by email during ETL). The legacy "Processor" text and
// "Name (from Team Link)" lookups are computed in serializers from that user.
export const personalPipelineTickets = pgTable(
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
// Corporate. TS name renamed to "pipeline tickets" (physical table name
// unchanged) to separate it conceptually from corporate_billing_bundles:
// this row is a unit of work (status/processor/notes/due dates), never a
// place money lives. billing_amount is DEPRECATED — application code no
// longer reads or writes it; a client's recurring monthly fee now lives
// entirely on corporate_billing_bundle_items, reached optionally via
// bundle_item_id when this ticket's service is part of a bundle. The column
// is dropped in a follow-up migration once historical amounts are carried
// into bundles (see scripts/migrate-to-billing-bundles.ts).
// Customer lookups (Company/EIN/etc.) are joins in serializers. processor_id
// is a remapped Better Auth user id; "Tax Preparer" here was a plain text
// name in Airtable.
export const corporatePipelineTickets = pgTable(
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
    /** @deprecated superseded by corporate_billing_bundle_items.amount via bundleItemId. Not read/written by app code; dropped in a later migration. */
    billingAmount: numeric('billing_amount'),
    // Set when this ticket's service is covered by the client's recurring
    // billing bundle — completing it then records a billing_records row at
    // status 'Covered by Bundle' instead of a one-off charge. Nullable: most
    // tickets are one-off work with no bundle involvement.
    bundleItemId: text('bundle_item_id').references(() => corporateBillingBundleItems.id, {
      onDelete: 'set null',
    }),
    // Which recurring period this ticket represents for its bundle item
    // (e.g. '2026-07'), so a future recurring-ticket generator can avoid
    // creating a duplicate ticket for the same bundle line/period. Not
    // populated/consumed yet in phase 1 — laid down so that capability
    // doesn't need another migration.
    billingPeriod: text('billing_period'),
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
    index('subscriptions_corporate_bundle_item_idx').on(t.bundleItemId),
    uniqueIndex('subscriptions_corporate_bundle_period_idx')
      .on(t.bundleItemId, t.billingPeriod)
      .where(sql`bundle_item_id IS NOT NULL`),
  ]
);

export const billingBundleStatus = pgEnum('billing_bundle_status', [
  'active',
  'paused',
  'cancelled',
]);

export const billingCycle = pgEnum('billing_cycle', ['monthly', 'quarterly', 'annual']);

// A corporate client's durable, client-level recurring billing relationship —
// "a monthly subscription that pays for many of the services provided to
// that client." One row per client's currently-active recurring engagement
// (enforced by the partial unique index below); the client's actual monthly
// total is never stored here, it's always computed as the live sum of this
// bundle's active corporate_billing_bundle_items. Corporate-only by design:
// personal clients are billed per-service and never get a bundle.
export const corporateBillingBundles = pgTable(
  'corporate_billing_bundles',
  {
    id: id(),
    corporationId: text('corporation_id')
      .notNull()
      .references(() => corporations.id, { onDelete: 'cascade' }),
    name: text('name'),
    status: billingBundleStatus('status').notNull().default('active'),
    billingCycle: billingCycle('billing_cycle').notNull().default('monthly'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('corporate_billing_bundles_corporation_idx').on(t.corporationId),
    uniqueIndex('corporate_billing_bundles_one_active_idx')
      .on(t.corporationId)
      .where(sql`status = 'active'`),
  ]
);

export const bundleItemStatus = pgEnum('bundle_item_status', ['active', 'removed']);

// One line item per service a bundle covers, carrying the actual dollar
// amount. Removing a service from a bundle is a soft delete (status
// 'removed' + end_date set), never a hard delete — pipeline tickets and
// billing_records may reference a line item by FK, and its billing history
// has standalone value even after the client stops paying for that service.
export const corporateBillingBundleItems = pgTable(
  'corporate_billing_bundle_items',
  {
    id: id(),
    bundleId: text('bundle_id')
      .notNull()
      .references(() => corporateBillingBundles.id, { onDelete: 'cascade' }),
    serviceId: text('service_id')
      .notNull()
      .references(() => servicesCorporate.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    status: bundleItemStatus('status').notNull().default('active'),
    effectiveDate: text('effective_date'),
    endDate: text('end_date'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('corporate_billing_bundle_items_bundle_idx').on(t.bundleId),
    uniqueIndex('corporate_billing_bundle_items_one_active_service_idx')
      .on(t.bundleId, t.serviceId)
      .where(sql`status = 'active'`),
  ]
);

// Airtable "Services Rendered" — completed work awaiting billing or already
// billed. TS name renamed to "billing records" (physical table name
// unchanged): conceptually this is now also "the ledger" — see
// billing_status. Client/service/processor are stored values (not lookups),
// by design, so they keep reading correctly even if the originating client
// or service is later renamed. ledger_entry_id is DEPRECATED (the separate
// Ledger table is dropped — every Ledger row was always just a copy of the
// Services Rendered row that produced it, so "billed and paid" is now the
// single source of truth for revenue actually recorded, right here via
// billing_status = 'Billed - Paid'). Dropped in a follow-up migration.
export const billingRecords = pgTable(
  'services_rendered',
  {
    id: id(),
    clientName: text('client_name'),
    clientType: text('client_type'), // 'personal' | 'corporate'
    billingStatus: text('billing_status'), // 'Unbilled' | 'Billed - Paid' | 'Billed - Unpaid' | 'Waived' | 'Covered by Bundle'
    serviceType: text('service_type'),
    serviceRenderedDate: text('service_rendered_date'),
    processor: text('processor'),
    amountCharged: numeric('amount_charged'),
    paymentMethod: text('payment_method'),
    receiptDate: text('receipt_date'),
    notes: text('notes'),
    subscriptionPersonalId: text('subscription_personal_id'), // no FK: historical rows may point at now-nonexistent tickets (subscriptions used to be deleted at billing time)
    subscriptionCorporateId: text('subscription_corporate_id'),
    /** @deprecated the separate ledger table is gone; not read/written by app code. Dropped in a later migration. */
    ledgerEntryId: text('ledger_entry_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('services_rendered_billing_status_idx').on(t.billingStatus),
    index('services_rendered_date_idx').on(t.serviceRenderedDate),
  ]
);

// Airtable "Ledger" — DEPRECATED, superseded by billing_records (see above).
// No longer written to by app code; dropped in a follow-up migration once
// its historical rows are confirmed carried forward (every ledger insert
// historically originated from the services-rendered bill flow, so none
// should be missing from billing_records).
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
      () => personalPipelineTickets.id,
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
      () => corporatePipelineTickets.id,
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
    servicesRenderedId: text('services_rendered_id').references(() => billingRecords.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('billing_notes_services_rendered_idx').on(t.servicesRenderedId)]
);
