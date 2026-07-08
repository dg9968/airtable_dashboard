/**
 * Phase 3 ETL: subscriptions / billing / notes.
 *
 *   Subscriptions Personal   → subscriptions_personal
 *   Subscriptions Corporate  → subscriptions_corporate
 *   Services Rendered        → services_rendered
 *   Ledger                   → ledger
 *   Pipeline Notes           → pipeline_notes
 *   Corporate Pipeline Notes → corporate_pipeline_notes
 *   Billing Notes            → billing_notes
 *
 * User-link remapping: the Airtable Users table was recreated after the auth
 * migration, so 'Tax Preparer' / 'Processor' links hold rec IDs that don't
 * match the Better Auth user table. This script maps old→new by email and
 * fails loudly (warning) for unmappable users.
 *
 * Idempotent (upsert on rec ID). Usage:
 *   bun run packages/server/scripts/etl/phase3-subscriptions.ts [--dry-run]
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
  personal,
  corporations,
  personalServices,
  servicesCorporate,
  subscriptionsPersonal,
  subscriptionsCorporate,
  servicesRendered,
  ledger,
  pipelineNotes,
  corporatePipelineNotes,
  billingNotes,
} from '../../src/db/schema';
import { authUser } from '../../src/db/auth-readonly';

requireEnv();

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  // --- Build Team-table-id → Better-Auth-user-id map (by email) ---
  // 'Tax Preparer' / 'Processor' links point at the Airtable "Team" table
  // (NOT "Users" — Users ids were preserved into Better Auth already).
  const userMapStats = newStats('Team → Better Auth user id map');
  const oldUsers = await fetchAll('Team');
  const authUsers = await db.select({ id: authUser.id, email: authUser.email }).from(authUser);
  const emailToNewId = new Map(authUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const userIdMap = new Map<string, string>();
  for (const u of oldUsers) {
    const email = String(u.fields['Email'] ?? '').toLowerCase();
    const newId = email ? emailToNewId.get(email) : undefined;
    if (newId) {
      userIdMap.set(u.id, newId);
    } else {
      userMapStats.warnings.push(
        `Airtable user ${u.id} (${u.fields['Name'] ?? '?'} <${email || 'no email'}>) has no Better Auth match — links will be NULL`
      );
    }
  }
  userMapStats.fetched = oldUsers.length;
  userMapStats.upserted = userIdMap.size;
  allStats.push(userMapStats);

  function mapUser(fields: Record<string, unknown>, name: string, stats: EtlStats, recordId: string): string | null {
    const oldId = linkOne(fields, name);
    if (!oldId) return null;
    const newId = userIdMap.get(oldId);
    if (!newId) {
      stats.orphanLinks.push({ recordId, field: name, missingTarget: oldId });
      return null;
    }
    return newId;
  }

  // --- Valid FK target sets (Postgres is the source of truth for entities) ---
  const personalIds = new Set((await db.select({ id: personal.id }).from(personal)).map((r) => r.id));
  const corporationIds = new Set((await db.select({ id: corporations.id }).from(corporations)).map((r) => r.id));
  const personalServiceIds = new Set((await db.select({ id: personalServices.id }).from(personalServices)).map((r) => r.id));
  const corporateServiceIds = new Set((await db.select({ id: servicesCorporate.id }).from(servicesCorporate)).map((r) => r.id));

  function checkedLink(
    fields: Record<string, unknown>,
    name: string,
    validIds: Set<string>,
    stats: EtlStats,
    recordId: string
  ): string | null {
    const id = linkOne(fields, name);
    if (!id) return null;
    if (!validIds.has(id)) {
      stats.orphanLinks.push({ recordId, field: name, missingTarget: id });
      return null;
    }
    return id;
  }

  // --- Subscriptions Personal ---
  const subsPersonalRecords = await fetchAll('Subscriptions Personal');
  const subsPersonalIds = new Set(subsPersonalRecords.map((r) => r.id));
  {
    const stats = newStats('Subscriptions Personal → subscriptions_personal');
    stats.fetched = subsPersonalRecords.length;
    const rows = subsPersonalRecords.map((r) => ({
      id: r.id,
      personalId: checkedLink(r.fields, 'Last Name', personalIds, stats, r.id),
      serviceId: checkedLink(r.fields, 'Service', personalServiceIds, stats, r.id),
      status: pickString(r.fields, 'Status'),
      notes: pickString(r.fields, 'Notes'),
      taxPreparerId: mapUser(r.fields, 'Tax Preparer', stats, r.id),
      extensionTaxYear: pickNumber(r.fields, 'Extension Tax Year'),
      extensionStatus: pickString(r.fields, 'Extension Status'),
      extensionFiledDate: pickString(r.fields, 'Extension Filed Date'),
      extensionEstimatedTax: pickNumber(r.fields, 'Extension Estimated Tax')?.toString() ?? null,
      extensionPaymentsCredits: pickNumber(r.fields, 'Extension Payments Credits')?.toString() ?? null,
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, subscriptionsPersonal, rows, stats);
    allStats.push(stats);
  }

  // --- Subscriptions Corporate ---
  const subsCorporateRecords = await fetchAll('Subscriptions Corporate');
  const subsCorporateIds = new Set(subsCorporateRecords.map((r) => r.id));
  {
    const stats = newStats('Subscriptions Corporate → subscriptions_corporate');
    stats.fetched = subsCorporateRecords.length;
    const rows = subsCorporateRecords.map((r) => ({
      id: r.id,
      corporationId: checkedLink(r.fields, 'Customer', corporationIds, stats, r.id),
      serviceId: checkedLink(r.fields, 'Services', corporateServiceIds, stats, r.id),
      status: pickString(r.fields, 'Status'),
      notes: pickString(r.fields, 'Notes'),
      processorId: mapUser(r.fields, 'Processor', stats, r.id),
      taxPreparer: pickString(r.fields, 'Tax Preparer'),
      dateAssigned: pickString(r.fields, 'Date Assigned'),
      billingAmount: pickNumber(r.fields, 'Billing Amount')?.toString() ?? null,
      filed: pickBoolean(r.fields, 'Filed'),
      sendToBookkeeper: pickBoolean(r.fields, 'Send to Bookkeeper'),
      duration: pickNumber(r.fields, 'Duration'),
      bookkeeperEstimate: pickString(r.fields, 'Bookkeeper Estimate'),
      dueDate: pickString(r.fields, 'Due Date'),
      quarterlyStDate: pickString(r.fields, 'Quarterly ST Date'),
      monthlyStDate: pickString(r.fields, 'Monthly ST Date'),
      extensionTaxYear: pickNumber(r.fields, 'Extension Tax Year'),
      extensionStatus: pickString(r.fields, 'Extension Status'),
      extensionFiledDate: pickString(r.fields, 'Extension Filed Date'),
      extensionEstimatedTax: pickNumber(r.fields, 'Extension Estimated Tax')?.toString() ?? null,
      extensionPaymentsCredits: pickNumber(r.fields, 'Extension Payments Credits')?.toString() ?? null,
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, subscriptionsCorporate, rows, stats);
    allStats.push(stats);
  }

  // --- Ledger (before Services Rendered so ledger_entry_id targets exist conceptually;
  //     no FK constraints between them, order is cosmetic) ---
  // Airtable's Ledger↔Services Rendered links are asymmetric in places, so we
  // collect the Ledger-side 'Services Rendered' arrays to backfill
  // services_rendered.ledger_entry_id where the SR side lacks the link.
  const ledgerEntryBySr = new Map<string, string>();
  {
    const stats = newStats('Ledger → ledger');
    const records = await fetchAll('Ledger');
    stats.fetched = records.length;
    for (const r of records) {
      const srIds = r.fields['Services Rendered'];
      if (Array.isArray(srIds)) {
        for (const srId of srIds) ledgerEntryBySr.set(String(srId), r.id);
      }
    }
    let amountSum = 0;
    const rows = records.map((r) => {
      const amount = pickNumber(r.fields, 'Amount Charged');
      amountSum += amount ?? 0;
      return {
        id: r.id,
        serviceRendered: pickString(r.fields, 'Service Rendered'),
        receiptDate: pickString(r.fields, 'Receipt Date'),
        amountCharged: amount?.toString() ?? null,
        nameOfClient: pickString(r.fields, 'Name of Client'),
        paymentMethod: pickString(r.fields, 'Payment Method'),
        subscriptionPersonalId: linkOne(r.fields, 'Subscription'),
        subscriptionCorporateId: linkOne(r.fields, 'Related Corporate Subscriptions'),
        createdAt: new Date(r.createdTime),
      };
    });
    stats.warnings.push(`Airtable Amount Charged total: ${amountSum.toFixed(2)} (verify against Postgres after run)`);
    await upsert(db, ledger, rows, stats);
    allStats.push(stats);
  }

  // --- Services Rendered ---
  const servicesRenderedRecords = await fetchAll('Services Rendered');
  const servicesRenderedIds = new Set(servicesRenderedRecords.map((r) => r.id));
  {
    const stats = newStats('Services Rendered → services_rendered');
    stats.fetched = servicesRenderedRecords.length;
    let amountSum = 0;
    const rows = servicesRenderedRecords.map((r) => {
      const amount = pickNumber(r.fields, 'Amount Charged');
      amountSum += amount ?? 0;
      return {
        id: r.id,
        clientName: pickString(r.fields, 'Client Name'),
        clientType: pickString(r.fields, 'Client Type'),
        billingStatus: pickString(r.fields, 'Billing Status'),
        serviceType: pickString(r.fields, 'Service Type'),
        serviceRenderedDate: pickString(r.fields, 'Service Rendered Date'),
        processor: pickString(r.fields, 'Processor'),
        amountCharged: amount?.toString() ?? null,
        paymentMethod: pickString(r.fields, 'Payment Method'),
        receiptDate: pickString(r.fields, 'Receipt Date'),
        notes: pickString(r.fields, 'Notes'),
        subscriptionPersonalId: linkOne(r.fields, 'Subscription Personal'),
        subscriptionCorporateId: linkOne(r.fields, 'Subscription Corporate'),
        ledgerEntryId: linkOne(r.fields, 'Ledger Entry') ?? ledgerEntryBySr.get(r.id) ?? null,
        createdAt: new Date(r.createdTime),
      };
    });
    stats.warnings.push(`Airtable Amount Charged total: ${amountSum.toFixed(2)} (verify against Postgres after run)`);
    await upsert(db, servicesRendered, rows, stats);
    allStats.push(stats);
  }

  // --- Note tables ---
  {
    const stats = newStats('Pipeline Notes → pipeline_notes');
    const records = await fetchAll('Pipeline Notes');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      subscriptionPersonalId: checkedLink(r.fields, 'Subscription', subsPersonalIds, stats, r.id),
      authorName: pickString(r.fields, 'Author Name'),
      authorEmail: pickString(r.fields, 'Author Email'),
      note: pickString(r.fields, 'Note'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, pipelineNotes, rows, stats);
    allStats.push(stats);
  }

  {
    const stats = newStats('Corporate Pipeline Notes → corporate_pipeline_notes');
    const records = await fetchAll('Corporate Pipeline Notes');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      subscriptionCorporateId: checkedLink(r.fields, 'Subscription', subsCorporateIds, stats, r.id),
      authorName: pickString(r.fields, 'Author Name'),
      authorEmail: pickString(r.fields, 'Author Email'),
      note: pickString(r.fields, 'Note'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, corporatePipelineNotes, rows, stats);
    allStats.push(stats);
  }

  {
    const stats = newStats('Billing Notes → billing_notes');
    const records = await fetchAll('Billing Notes');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      servicesRenderedId: checkedLink(r.fields, 'Services Rendered', servicesRenderedIds, stats, r.id),
      authorName: pickString(r.fields, 'Author Name'),
      authorEmail: pickString(r.fields, 'Author Email'),
      note: pickString(r.fields, 'Note'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, billingNotes, rows, stats);
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
