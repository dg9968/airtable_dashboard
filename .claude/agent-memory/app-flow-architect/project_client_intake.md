---
name: project_client_intake
description: Personal and Corporate intake component architecture, key API fan-out patterns, and bottlenecks discovered during first review
metadata:
  type: project
---

Personal intake is in `packages/client/components/ClientIntake.tsx`, mounted at `/client-intake`.
Corporate intake is in `packages/client/components/CorporateClientIntake.tsx`, mounted at `/corporate-client-intake`.

**Why:** These are the primary staff-facing data-entry points for the tax prep business. Understanding their exact behavior is essential for any improvement suggestions.

**How to apply:** When discussing intake, search, or pipeline-add flows, use these observations as the authoritative baseline.

## Key architectural observations

- No Next.js middleware.ts file exists. All route protection is client-side only via useEffect session checks inside components. This is a security gap.
- Corporate intake page.tsx runs `useRequireRole` AND the component itself re-checks the role — triple layer of duplication.
- Personal intake page.tsx does NOT use `useRequireRole`; it only wraps in Suspense and delegates all auth checking to the component itself.

## Critical data flow issues

### Personal intake — N+1 dependent loading
When loading an existing client, the component fires one fetch per linked dependent/spouse rather than batching. With 3 categories (Child, Parent, OtherDependent) each potentially having multiple records, a client with 5 dependents triggers at minimum 6–8 sequential Airtable API calls on load. Airtable rate-limits at 5 req/s.

### Corporate search — full table scan
`handleSearch` in CorporateClientIntake fetches the ENTIRE Corporations table (`GET /api/view?table=Corporations&view=Grid view`) and filters in the browser. On a large base this is slow and wastes bandwidth. The `companies.ts` route already has a proper server-side `/api/companies/search` endpoint with Airtable `filterByFormula` that is NOT being used.

### Personal search — full table scan in server
`GET /api/personal/search` fetches ALL personal records via `fetchAllRecords` then filters in JS. No Airtable `filterByFormula` is used.

### Subscriptions-personal duplicate check field name bug
In `subscriptions-personal.ts` POST, the duplicate-check logic uses `sub.fields['Last Name']` to find the linked personal record ID — this is almost certainly the wrong field name and will fail silently, creating duplicate subscriptions. The junction record is written using `'Last Name': [personalId]` as the link field (also suspicious naming).

### Corporate contact search — full table scan
`handleSearchContacts` fetches the entire Personal table via `/api/view?table=Personal&view=Grid view` and filters in the browser.

### Client code generation on every client selection
Every time a client is selected in personal intake, a `getOrGenerateClientCode` call may fire a PATCH to Airtable if the client lacks a code. This is a side effect that should not happen inside a selection handler and cannot be undone.

### Corporate save auto-redirects
After a successful corporate save, the component unconditionally redirects to `/corporate-client-intake?id=...` after 1.5 seconds. This means if a staff member was in the middle of entering contacts, they lose form context on every save.

### Unlink spouse UX gap
The "Unlink" spouse button in personal intake uses `confirm()` (a browser blocking dialog), does not call any API to actually remove the Airtable link, and only clears local state. The relationship persists in Airtable silently.

### handleSave does not send spouse/dependents
The personal intake `handleSave` strips out all spouse and dependent fields before sending to the API (they are excluded from `fieldsToSave`). The server routes for POST and PATCH DO accept `body.spouse` and `body.dependents`, but the client never sends them. New-client dependents added via the form are therefore silently dropped.
