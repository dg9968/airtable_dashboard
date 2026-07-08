/**
 * Phase 6 ETL (late addition): Sales Tax Certificate Info.
 *
 * Discovered while retiring Airtable — not in the original 6-domain inventory.
 * Used by the Corporate Client Intake "ST Certificate" search
 * (view.ts /api/view?table=Sales Tax Certificate Info).
 *
 *   Sales Tax Certificate Info → sales_tax_certificates
 *
 * Also backfills corporations.st_certificate_values / business_partner_numbers
 * (denormalized display snapshots) from the now-migrated source table, fixing
 * any drift since the Phase 2 ETL snapshot.
 *
 * Idempotent (upsert on rec ID). Usage:
 *   bun run packages/server/scripts/etl/phase6-sales-tax-certificates.ts [--dry-run]
 */

import {
  requireEnv,
  isDryRun,
  fetchAllOptional,
  pickString,
  pickNumber,
  linkOne,
  upsert,
  newStats,
  report,
  getEtlDb,
  closeEtlDb,
  type EtlStats,
} from './lib';
import { salesTaxCertificates, corporations } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

requireEnv();

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  const corporationIds = new Set(
    (await db.select({ id: corporations.id }).from(corporations)).map((r) => r.id)
  );

  const stats = newStats('Sales Tax Certificate Info → sales_tax_certificates');
  const records = await fetchAllOptional('Sales Tax Certificate Info');

  if (records === null) {
    stats.warnings.push('Table not found in Airtable — skipped');
    report([stats]);
    await closeEtlDb();
    return;
  }

  stats.fetched = records.length;

  // The link field back to Corporations is (confusingly) named
  // "Company Name (from Company Name (from Status))" in this base — its
  // *value* is an array of Corporations rec IDs, not a lookup string.
  const rows = records.map((r) => {
    const corporationId = linkOne(r.fields, 'Company Name (from Company Name (from Status))');
    let resolvedCorporationId: string | null = null;
    if (corporationId) {
      if (corporationIds.has(corporationId)) {
        resolvedCorporationId = corporationId;
      } else {
        stats.orphanLinks.push({
          recordId: r.id,
          field: 'Company Name (from Company Name (from Status))',
          missingTarget: corporationId,
        });
      }
    }
    return {
      id: r.id,
      stCertificate: pickString(r.fields, 'ST Certificate'),
      companyName: pickString(r.fields, 'Company Name'),
      businessPartner: pickNumber(r.fields, 'Business Partner'),
      frequency: pickString(r.fields, 'Frequency'),
      corporationId: resolvedCorporationId,
      createdAt: new Date(r.createdTime),
    };
  });

  await upsert(db, salesTaxCertificates, rows, stats);
  allStats.push(stats);

  // --- Backfill corporations.st_certificate_values / business_partner_numbers ---
  const backfillStats = newStats('Backfill corporations ST cert snapshots');
  if (!isDryRun) {
    const certRows = await db.select().from(salesTaxCertificates);
    const byCorporation = new Map<string, typeof certRows>();
    for (const cert of certRows) {
      if (!cert.corporationId) continue;
      const list = byCorporation.get(cert.corporationId) ?? [];
      list.push(cert);
      byCorporation.set(cert.corporationId, list);
    }

    const corpRows = await db
      .select({ id: corporations.id, stCertificateNumberIds: corporations.stCertificateNumberIds })
      .from(corporations);

    let updated = 0;
    for (const corp of corpRows) {
      if (!corp.stCertificateNumberIds || corp.stCertificateNumberIds.length === 0) continue;
      const certs = corp.stCertificateNumberIds
        .map((certId) => certRows.find((c) => c.id === certId))
        .filter((c): c is (typeof certRows)[number] => Boolean(c));
      const stCertificateValues = certs.map((c) => c.stCertificate).filter((v): v is string => Boolean(v));
      const businessPartnerNumbers = certs
        .map((c) => c.businessPartner)
        .filter((v): v is number => v != null)
        .map(String);

      await db
        .update(corporations)
        .set({ stCertificateValues, businessPartnerNumbers })
        .where(eq(corporations.id, corp.id));
      updated++;
    }
    backfillStats.fetched = corpRows.length;
    backfillStats.upserted = updated;
  } else {
    console.log('  [dry-run] would backfill corporations ST cert snapshots');
  }
  allStats.push(backfillStats);

  report(allStats);
  if (isDryRun) console.log('Dry run complete — nothing written.');
  await closeEtlDb();
}

main().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
