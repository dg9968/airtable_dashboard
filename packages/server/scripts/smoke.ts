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

  // Still Airtable-backed (regression canaries for untouched routes)
  { path: '/api/tax-notices', keys: ['success'] },
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
