/**
 * Shared logic for scripts that merge one `corporations` row into another
 * (repoint every FK-linked table, repoint `documents` by client_code, score
 * candidates by how much real data they carry). Used by both
 * `dedupe-corporations.ts` (accidental duplicates) and
 * `consolidate-multilocation-corporations.ts` (legitimate multi-location
 * splits that need certificate-aware handling on top of this).
 */

import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/db/schema';

const {
  corporatePipelineTickets,
  corporateBillingBundles,
  companyContacts,
  salesTaxCertificates,
  signingEnvelopes,
  communicationsCorporate,
  documents,
} = schema;

export type Db = NodePgDatabase<typeof schema>;

// Every table with a real FK to corporations.id, repointed to the keeper
// before the loser row is deleted.
export const FK_TABLES = [
  { table: corporatePipelineTickets, column: corporatePipelineTickets.corporationId, name: 'corporate_pipeline_tickets' },
  { table: corporateBillingBundles, column: corporateBillingBundles.corporationId, name: 'corporate_billing_bundles' },
  { table: companyContacts, column: companyContacts.corporationId, name: 'company_contacts' },
  { table: salesTaxCertificates, column: salesTaxCertificates.corporationId, name: 'sales_tax_certificates' },
  { table: signingEnvelopes, column: signingEnvelopes.corporationId, name: 'signing_envelopes' },
  { table: communicationsCorporate, column: communicationsCorporate.corporationId, name: 'communications_corporate' },
] as const;

export async function relatedRowCount(db: Db, corporationId: string, clientCode: string | null): Promise<number> {
  let total = 0;
  for (const { table, column } of FK_TABLES) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(eq(column, corporationId));
    total += count;
  }
  if (clientCode) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.clientCode, clientCode));
    total += count;
  }
  return total;
}

export async function hasActiveBundle(db: Db, corporationId: string): Promise<boolean> {
  const [active] = await db
    .select({ id: corporateBillingBundles.id })
    .from(corporateBillingBundles)
    .where(
      sql`${corporateBillingBundles.corporationId} = ${corporationId} and ${corporateBillingBundles.status} = 'active'`
    )
    .limit(1);
  return !!active;
}

/** Repoints every FK_TABLES row from loserId to keeperId. Logs what moved. */
export async function repointForeignKeys(tx: Db, keeperId: string, loserId: string): Promise<void> {
  for (const { table, column, name } of FK_TABLES) {
    const result = await tx.update(table).set({ corporationId: keeperId } as never).where(eq(column, loserId));
    const rowCount = (result as { rowCount?: number }).rowCount;
    if (rowCount) {
      console.log(`    repointed ${rowCount} row(s) in ${name}`);
    }
  }
}

/** documents links to corporations by client_code text, not a FK — repointed separately. */
export async function repointDocuments(
  tx: Db,
  keeperClientCode: string | null,
  loserClientCode: string | null
): Promise<void> {
  if (!keeperClientCode || !loserClientCode || keeperClientCode === loserClientCode) return;
  const result = await tx.update(documents).set({ clientCode: keeperClientCode }).where(eq(documents.clientCode, loserClientCode));
  const rowCount = (result as { rowCount?: number }).rowCount;
  if (rowCount) {
    console.log(`    repointed ${rowCount} document(s) client_code`);
  }
}
