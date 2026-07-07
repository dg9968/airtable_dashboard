/**
 * Phase 1 ETL: catalog + knowledge tables (no FKs except articles→categories).
 *
 *   Personal Services     → personal_services
 *   Services Corporate    → services_corporate
 *   Message Templates     → message_templates
 *   Signing Templates     → signing_templates
 *   Knowledge Categories  → knowledge_categories
 *   Knowledge Articles    → knowledge_articles
 *
 * Idempotent (upsert on rec ID). Usage from repo root:
 *   bun run packages/server/scripts/etl/phase1-catalogs.ts [--dry-run]
 */

import {
  requireEnv,
  isDryRun,
  fetchAll,
  fetchAllOptional,
  pickString,
  pickNumber,
  pickBoolean,
  linkOne,
  linkMany,
  upsert,
  resolveLink,
  newStats,
  report,
  getEtlDb,
  closeEtlDb,
  type EtlStats,
} from './lib';
import {
  personalServices,
  servicesCorporate,
  messageTemplates,
  signingTemplates,
  knowledgeCategories,
  knowledgeArticles,
} from '../../src/db/schema';

requireEnv();

async function main() {
  const db = getEtlDb();
  const allStats: EtlStats[] = [];

  // --- Personal Services ---
  {
    const stats = newStats('Personal Services → personal_services');
    const records = await fetchAll('Personal Services');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      name:
        pickString(r.fields, 'Services', 'Service', 'Service Name', 'Name', 'Service Type', 'Service Title', 'Title', 'Description') ??
        'Unnamed Service',
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, personalServices, rows, stats);
    allStats.push(stats);
  }

  // --- Services Corporate ---
  {
    const stats = newStats('Services Corporate → services_corporate');
    const records = await fetchAll('Services Corporate');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      name:
        pickString(r.fields, 'Services', 'Service', 'Service Name', 'Name', 'Service Type', 'Service Title', 'Title', 'Description') ??
        'Unnamed Service',
      price: pickNumber(r.fields, 'Price')?.toString() ?? null,
      description: pickString(r.fields, 'Description'),
      category: pickString(r.fields, 'Category'),
      billingCycle: pickString(r.fields, 'Billing Cycle'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, servicesCorporate, rows, stats);
    allStats.push(stats);
  }

  // --- Message Templates ---
  {
    const stats = newStats('Message Templates → message_templates');
    const records = await fetchAll('Message Templates');
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      templateName: pickString(r.fields, 'Template Name') ?? '',
      templateCode: pickString(r.fields, 'Template Code'),
      subjectTemplate: pickString(r.fields, 'Subject Template'),
      contentTemplate: pickString(r.fields, 'Content Template'),
      description: pickString(r.fields, 'Description'),
      variableDefinitions: pickString(r.fields, 'Variable Definitions'),
      category: pickString(r.fields, 'Category'),
      status: pickString(r.fields, 'Status'),
      createdDate: pickString(r.fields, 'Created Date'),
      lastUsedDate: pickString(r.fields, 'Last Used Date'),
      createdAt: new Date(r.createdTime),
    }));
    // Sanity: Variable Definitions must be valid JSON when present (routes JSON.parse it)
    for (const row of rows) {
      if (row.variableDefinitions) {
        try {
          JSON.parse(row.variableDefinitions);
        } catch {
          stats.warnings.push(`${row.id}: Variable Definitions is not valid JSON`);
        }
      }
    }
    await upsert(db, messageTemplates, rows, stats);
    allStats.push(stats);
  }

  // --- Signing Templates (optional — table may not exist in the base) ---
  {
    const stats = newStats('Signing Templates → signing_templates');
    const records = await fetchAllOptional('Signing Templates');
    if (records === null) {
      stats.warnings.push('Table not found in Airtable — skipped (docusign routes treat it as optional)');
      allStats.push(stats);
    } else {
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      templateName: pickString(r.fields, 'Template Name') ?? '',
      templateCode: pickString(r.fields, 'Template Code'),
      dropboxSignTemplateId: pickString(r.fields, 'Dropbox Sign Template ID'),
      documentTypes: linkMany(r.fields, 'Document Types'), // multi-select → text[]
      clientType: pickString(r.fields, 'Client Type'),
      numberOfSigners: pickNumber(r.fields, 'Number of Signers'),
      description: pickString(r.fields, 'Description'),
      status: pickString(r.fields, 'Status'),
      sortOrder: pickNumber(r.fields, 'Sort Order'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, signingTemplates, rows, stats);
    allStats.push(stats);
    }
  }

  // --- Knowledge Categories (before articles: FK target; optional table) ---
  const categoryIds = new Set<string>();
  {
    const stats = newStats('Knowledge Categories → knowledge_categories');
    const records = (await fetchAllOptional('Knowledge Categories')) ?? [];
    if (records.length === 0) {
      stats.warnings.push('No records (table missing or empty) — knowledge routes return setupRequired in that case');
    }
    stats.fetched = records.length;
    const rows = records.map((r) => {
      categoryIds.add(r.id);
      return {
        id: r.id,
        name: pickString(r.fields, 'Name') ?? '',
        slug: pickString(r.fields, 'Slug'),
        description: pickString(r.fields, 'Description'),
        icon: pickString(r.fields, 'Icon'),
        color: pickString(r.fields, 'Color'),
        sortOrder: pickNumber(r.fields, 'Sort Order'),
        status: pickString(r.fields, 'Status'),
        createdAt: new Date(r.createdTime),
      };
    });
    await upsert(db, knowledgeCategories, rows, stats);
    allStats.push(stats);
  }

  // --- Knowledge Articles (optional table) ---
  {
    const stats = newStats('Knowledge Articles → knowledge_articles');
    const records = (await fetchAllOptional('Knowledge Articles')) ?? [];
    if (records.length === 0) {
      stats.warnings.push('No records (table missing or empty)');
    }
    stats.fetched = records.length;
    const rows = records.map((r) => ({
      id: r.id,
      title: pickString(r.fields, 'Title') ?? '',
      slug: pickString(r.fields, 'Slug'),
      summary: pickString(r.fields, 'Summary'),
      content: pickString(r.fields, 'Content'),
      categoryId: resolveLink(linkOne(r.fields, 'Category'), categoryIds, stats, r.id, 'Category'),
      tags: linkMany(r.fields, 'Tags'), // multi-select → text[]
      status: pickString(r.fields, 'Status'),
      authorName: pickString(r.fields, 'Author Name'),
      authorEmail: pickString(r.fields, 'Author Email'),
      viewCount: pickNumber(r.fields, 'View Count') ?? 0,
      featured: pickBoolean(r.fields, 'Featured'),
      createdDate: pickString(r.fields, 'Created Date') ?? r.createdTime,
      lastModified: pickString(r.fields, 'Last Modified'),
      createdAt: new Date(r.createdTime),
    }));
    await upsert(db, knowledgeArticles, rows, stats);
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
