// Business-data schema. One file per domain, added phase by phase:
//   Phase 1: catalogs.ts
//   Phase 2: people.ts
//   Phase 3: subscriptions.ts
//   Phase 4: documents.ts, tax-notices.ts
//   Phase 5: communications.ts, knowledge.ts, envelopes.ts
// The Better Auth tables (user, session, account, verification) are owned by
// packages/client/scripts/run-migrations.ts and must NEVER be declared here —
// the read-only user definition for joins lives in ../auth-readonly.ts,
// outside this folder, so drizzle-kit never generates DDL for it.

export {};
