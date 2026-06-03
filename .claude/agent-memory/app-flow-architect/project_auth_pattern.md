---
name: project_auth_pattern
description: Route protection relies on client-side session checks only — no Next.js middleware.ts exists
metadata:
  type: project
---

No `middleware.ts` file exists in `packages/client/`. All route protection is done client-side via `useEffect` inside components or via the `useRequireRole` hook in `packages/client/hooks/useAuth.ts`.

**Why:** This was discovered during the first client intake flow review (2026-06-03).

**How to apply:** Any protected route (admin, staff) is accessible server-side rendered without auth. Middleware-level protection would be a High-priority security improvement. Do not assume middleware exists when suggesting where to add checks.

## Inconsistency between pages
- `/corporate-client-intake/page.tsx` uses `useRequireRole` from the hook AND the component also checks the role.
- `/client-intake/page.tsx` uses NO hook; delegates entirely to the component's internal `useEffect`.
- Both patterns expose the initial render to unauthenticated users before the redirect fires.
