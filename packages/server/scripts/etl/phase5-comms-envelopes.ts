/**
 * Phase 5 ETL: messages / communications-corporate / signing envelopes.
 *
 *   Messages                 → messages
 *   Communications Corporate → communications_corporate
 *   Signing Envelopes        → signing_envelopes (status must fit the pgEnum)
 *
 * Idempotent (upsert on rec ID). Usage:
 *   bun run packages/server/scripts/etl/phase5-comms-envelopes.ts [--dry-run]
 */

import {
  requireEnv,
  isDryRun,
  fetchAll,
  fetchAllOptional,
  pickString,
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
  messages,
  communicationsCorporate,
  signingEnvelopes,
  messageTemplates,
  corporations,
  documents,
  personal,
  signingTemplates,
} from '../../src/db/schema';

requireEnv();

const VALID_ENVELOPE_STATUSES = new Set([
  'Created', 'Sent', 'Delivered', 'Viewed', 'Signed', 'Completed', 'Declined', 'Voided',
]);

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  const messageTemplateIds = new Set(
    (await db.select({ id: messageTemplates.id }).from(messageTemplates)).map((r) => r.id)
  );
  const corporationIds = new Set(
    (await db.select({ id: corporations.id }).from(corporations)).map((r) => r.id)
  );
  const documentIds = new Set(
    (await db.select({ id: documents.id }).from(documents)).map((r) => r.id)
  );
  const personalIds = new Set(
    (await db.select({ id: personal.id }).from(personal)).map((r) => r.id)
  );
  const signingTemplateIds = new Set(
    (await db.select({ id: signingTemplates.id }).from(signingTemplates)).map((r) => r.id)
  );

  function checkedLink(
    fields: Record<string, unknown>,
    name: string,
    validIds: Set<string>,
    stats: EtlStats,
    recordId: string
  ): string | null {
    const idVal = linkOne(fields, name);
    if (!idVal) return null;
    if (!validIds.has(idVal)) {
      stats.orphanLinks.push({ recordId, field: name, missingTarget: idVal });
      return null;
    }
    return idVal;
  }

  // --- Messages ---
  const messageRecords = await fetchAll('Messages');
  {
    const stats = newStats('Messages → messages');
    stats.fetched = messageRecords.length;
    const rows = messageRecords.map((r) => ({
      id: r.id,
      emailSubject: pickString(r.fields, 'Email Subject'),
      emailContent: pickString(r.fields, 'Email Content'),
      isBatchMessage: pickBoolean(r.fields, 'Is Batch Message'),
      batchId: pickString(r.fields, 'Batch ID'),
      templateUsedId: checkedLink(r.fields, 'Template Used', messageTemplateIds, stats, r.id),
      variablesUsed: pickString(r.fields, 'Variables Used'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, messages, rows, stats);
    allStats.push(stats);
  }

  // --- Communications Corporate ---
  {
    const stats = newStats('Communications Corporate → communications_corporate');
    const records = await fetchAll('Communications Corporate');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      messageId: linkOne(r.fields, 'Message'), // Messages table fully migrated above
      corporationId: checkedLink(r.fields, 'Corporate', corporationIds, stats, r.id),
      status: pickString(r.fields, 'Status'),
      description: pickString(r.fields, 'Description'),
      batchId: pickString(r.fields, 'Batch ID'),
      personalizedSubject: pickString(r.fields, 'Personalized Subject'),
      personalizedContent: pickString(r.fields, 'Personalized Content'),
      variableValues: pickString(r.fields, 'Variable Values'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, communicationsCorporate, rows, stats);
    allStats.push(stats);
  }

  // --- Signing Envelopes ---
  {
    const stats = newStats('Signing Envelopes → signing_envelopes');
    const records = await fetchAll('Signing Envelopes');
    stats.fetched = records.length;

    for (const r of records) {
      const status = pickString(r.fields, 'Status') ?? 'Created';
      if (!VALID_ENVELOPE_STATUSES.has(status)) {
        throw new Error(`Envelope ${r.id} has status "${status}" outside the enum — resolve in Airtable before migrating`);
      }
    }

    const rows = records.map((r) => ({
      id: r.id,
      status: (pickString(r.fields, 'Status') ?? 'Created') as any,
      clientType: pickString(r.fields, 'Client Type'),
      signerEmail: pickString(r.fields, 'Signer Email'),
      signerName: pickString(r.fields, 'Signer Name'),
      signer2Email: pickString(r.fields, 'Signer 2 Email'),
      signer2Name: pickString(r.fields, 'Signer 2 Name'),
      taxYear: pickString(r.fields, 'Tax Year'),
      documentType: pickString(r.fields, 'Document Type'),
      sourceDriveFileId: pickString(r.fields, 'Source Drive File ID'),
      createdBy: pickString(r.fields, 'Created By'),
      documentId: checkedLink(r.fields, 'Document', documentIds, stats, r.id),
      personalId: checkedLink(r.fields, 'Personal', personalIds, stats, r.id),
      corporationId: checkedLink(r.fields, 'Corporation', corporationIds, stats, r.id),
      templateUsedId: checkedLink(r.fields, 'Template Used', signingTemplateIds, stats, r.id),
      envelopeId: pickString(r.fields, 'Envelope ID'),
      errorMessage: pickString(r.fields, 'Error Message'),
      sentAt: pickString(r.fields, 'Sent At'),
      completedAt: pickString(r.fields, 'Completed At'),
      signedDriveFileId: pickString(r.fields, 'Signed Drive File ID'),
      voidedAt: pickString(r.fields, 'Voided At'),
      voidReason: pickString(r.fields, 'Void Reason'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, signingEnvelopes, rows, stats);
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
