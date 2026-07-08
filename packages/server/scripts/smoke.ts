/**
 * Smoke tests: hits GET endpoints and asserts status + expected response keys.
 * Grows with each migration phase. No test framework — exits 1 on any failure.
 *
 * Usage:
 *   bun run scripts/smoke.ts                      # against http://localhost:3001
 *   bun run scripts/smoke.ts https://vault-api.onrender.com
 */

const baseUrl = process.argv[2] || 'http://localhost:3001';

interface Check {
  path: string;
  /** Keys that must be present (dot paths). */
  keys: string[];
  /** Optional predicate on the parsed body. */
  assert?: (body: any) => string | null;
}

const checks: Check[] = [
  { path: '/health', keys: ['status'] },
  { path: '/api/health/db', keys: ['status', 'postgres'], assert: (b) => (b.postgres === true ? null : 'postgres !== true') },

  // Phase 1 — catalogs + knowledge (Postgres-backed)
  {
    path: '/api/services',
    keys: ['success', 'data.services', 'data.serviceNames'],
    assert: (b) => (Array.isArray(b.data?.services) && b.data.services.length > 0 ? null : 'no services'),
  },
  {
    path: '/api/services-cached',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no services'),
  },
  {
    path: '/api/services-personal',
    keys: ['success', 'services'],
    assert: (b) => (Array.isArray(b.services) && b.services.length > 0 ? null : 'no services'),
  },
  { path: '/api/message-templates', keys: ['success', 'data', 'count'] },
  {
    path: '/api/knowledge-categories',
    keys: ['success', 'data', 'count'],
    assert: (b) => (Array.isArray(b.data) && b.data.every((cat: any) => 'articleCount' in cat) ? null : 'missing articleCount'),
  },
  { path: '/api/knowledge-articles?status=all', keys: ['success', 'data', 'count'] },

  // Phase 2 — core entities (Postgres-backed)
  {
    path: '/api/personal',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 && b.data[0].fields ? null : 'no personal records'),
  },
  {
    path: '/api/contacts',
    keys: ['success', 'data', 'count'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no contacts'),
  },
  {
    path: '/api/companies',
    keys: ['success', 'data', 'count'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no companies'),
  },
  { path: '/api/companies/search?q=inc', keys: ['success', 'data'] },
  { path: '/api/company-contacts', keys: ['success', 'data', 'count'] },
  {
    path: '/api/view?table=Personal&view=Grid view',
    keys: ['success', 'data.records', 'data.stats'],
    assert: (b) => (Array.isArray(b.data?.records) && b.data.records.length > 0 ? null : 'no records'),
  },
  {
    path: '/api/view?table=Corporations',
    keys: ['success', 'data.records'],
    assert: (b) => (Array.isArray(b.data?.records) && b.data.records.length > 0 ? null : 'no records'),
  },
  // Phase 3 — subscriptions / billing / notes (Postgres-backed)
  {
    path: '/api/teams',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no team members'),
  },
  {
    path: '/api/subscriptions-personal',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) ? null : 'data not array'),
  },
  { path: '/api/subscriptions-personal?view=File Extension', keys: ['success', 'data'] },
  {
    path: '/api/subscriptions-corporate',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no corporate subscriptions'),
  },
  {
    path: '/api/services-rendered',
    keys: ['success', 'data.services', 'data.summary'],
  },
  {
    path: '/api/ledger',
    keys: ['success', 'data.entries', 'data.summary'],
    assert: (b) => (b.data.summary.totalRevenue > 0 ? null : 'zero revenue'),
  },
  { path: '/api/processor-billing', keys: ['success', 'data.records'] },
  { path: '/api/service-by-client', keys: ['success', 'data.records'] },
  { path: '/api/business-stats', keys: ['success', 'data.totalClients'] },
  { path: '/api/pipeline-notes', keys: ['success', 'data'] },
  { path: '/api/corporate-pipeline-notes', keys: ['success', 'data'] },
  { path: '/api/billing-notes', keys: ['success', 'data'] },

  // Phase 4 — documents + tax notices (Postgres-backed)
  {
    path: '/api/tax-notices',
    keys: ['success', 'data', 'count'],
    assert: (b) => (Array.isArray(b.data) && b.data.every((n: any) => 'daysUntilDue' in n) ? null : 'missing daysUntilDue'),
  },
  { path: '/api/tax-notices/review-queue', keys: ['success', 'data'] },
  { path: '/api/tax-notices/deadline-monitor', keys: ['success', 'data'] },
  {
    path: '/api/documents?clientCode=3419&taxYear=2025',
    keys: ['documents'],
    assert: (b) => (Array.isArray(b.documents) && b.documents.length > 0 ? null : 'no documents'),
  },
  { path: '/api/documents/debug-all?maxRecords=5', keys: ['success', 'records'] },

  // Phase 5 — messages / communications / signing envelopes (Postgres-backed)
  {
    path: '/api/messages',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no messages'),
  },
  {
    path: '/api/communications-corporate',
    keys: ['success', 'data'],
    assert: (b) => (Array.isArray(b.data) && b.data.length > 0 ? null : 'no communications'),
  },
  {
    path: '/api/docusign/envelopes',
    keys: ['success', 'envelopes', 'total'],
    assert: (b) => (Array.isArray(b.envelopes) && b.envelopes.length > 0 ? null : 'no envelopes'),
  },
  { path: '/api/docusign/status', keys: ['success', 'configured'] },
];

function getPath(obj: any, dotPath: string): unknown {
  return dotPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

let failures = 0;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => null);

    const problems: string[] = [];
    if (res.status !== 200) problems.push(`status ${res.status}`);
    if (body === null) problems.push('body is not JSON');
    else {
      for (const key of check.keys) {
        if (getPath(body, key) === undefined) problems.push(`missing key "${key}"`);
      }
      if (check.assert) {
        const msg = check.assert(body);
        if (msg) problems.push(msg);
      }
    }

    if (problems.length > 0) {
      failures++;
      console.log(`❌ ${check.path} — ${problems.join('; ')}`);
    } else {
      console.log(`✅ ${check.path}`);
    }
  } catch (err) {
    failures++;
    console.log(`❌ ${check.path} — ${err instanceof Error ? err.message : err}`);
  }
}

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} smoke test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
