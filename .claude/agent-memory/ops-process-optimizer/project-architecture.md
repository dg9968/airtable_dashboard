---
name: project-architecture
description: Key architectural patterns discovered in the codebase — Airtable helpers, Hono route structure, auth hooks, UI components
metadata:
  type: project
---

## Server (packages/server/src/)

- All Airtable access goes through `packages/server/src/lib/airtable-helpers.ts` which wraps the REST API directly (NOT the Airtable JS library) — this is intentional to avoid an AbortSignal bug in the library.
- Functions available: `fetchAllRecords`, `createRecords`, `updateRecords`, `deleteRecords`, `getRecord`
- Every new route file in `packages/server/src/routes/` MUST be registered in BOTH `index.ts` (Bun dev) AND `node-server.ts` (production on Render.com). Failing to update node-server.ts causes 404s in production.
- Routes follow a consistent pattern: `const BASE_ID = process.env.AIRTABLE_BASE_ID || ''` at top of file
- Airtable field names use Title Case with spaces (e.g., `'Author Name'`, `'Created Time'`, `'Status'`)
- Linked record fields in Airtable are stored as arrays of record IDs (e.g., `fields['Subscription'] = [subscriptionId]`)

## Auth (Better Auth, migrated from NextAuth)

- Auth is Better Auth with PostgreSQL database (not Airtable) for user storage
- User roles are stored as an additional field: `role` — values are `admin`, `staff`, `user`
- Client hook: `useRequireRole('admin')` or `useRequireRole(['admin', 'staff'])` from `packages/client/hooks/useAuth.ts`
- Returns `{ session, isPending }` — check `isPending` before rendering protected content
- User role accessed via `(session.user as any)?.role`

## Frontend (packages/client/)

- UI components: shadcn/ui in `packages/client/components/ui/` — Button, Table, Input, Label, Badge, Select, Dialog, AlertDialog, DropdownMenu
- Pattern for protected admin pages: `useRequireRole('admin')` at top, check `isPending` then `!session` before rendering
- Data fetching: direct `fetch()` calls to `NEXT_PUBLIC_API_URL` — no React Query or SWR in use
- Styling: Tailwind + DaisyUI, dark theme with `bg-gray-900` / `bg-gray-800` / `text-white` patterns
- Client components use `'use client'` directive at top

## Why: 
These patterns were discovered by reading the actual source files in June 2026. They represent the settled architectural conventions for this project.

## How to apply:
Always follow these patterns when adding new features — use airtable-helpers (not the library), register routes in both entry points, use `useRequireRole` for auth, use shadcn/ui components from the existing set.
