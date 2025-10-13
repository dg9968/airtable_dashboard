# Migration Guide: Monorepo Refactoring

This document outlines the changes made during the monorepo refactoring and provides guidance for completing the migration.

## What Changed

### Project Structure

**Before:**
```
airtable-dashboard/
├── app/              # Next.js app with pages AND API routes
├── components/
├── lib/
├── public/
├── package.json
└── next.config.js
```

**After:**
```
airtable-dashboard/
├── packages/
│   ├── client/       # Next.js frontend only
│   │   ├── app/      # Pages, layouts (NO API routes)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── public/
│   │   └── package.json
│   └── server/       # Bun + Hono API server
│       ├── src/
│       │   ├── api/  # Former Next.js API routes
│       │   ├── lib/  # Backend utilities
│       │   └── index.ts
│       └── package.json
└── package.json      # Root workspace config
```

### Package Manager

- **Before:** npm
- **After:** Bun (with workspace support)

### API Architecture

- **Before:** Next.js API routes in `app/api/`
- **After:** Standalone Bun server with Hono framework in `packages/server/src/api/`

## Next Steps to Complete Migration

### 1. Install Dependencies

```bash
# Remove old node_modules and lock files
rm -rf node_modules package-lock.json

# Install with Bun
bun install
```

### 2. Set Up Environment Variables

Copy and configure environment files:

```bash
# Client environment
cp packages/client/.env.example packages/client/.env.local
# Edit packages/client/.env.local with your values

# Server environment
cp packages/server/.env.example packages/server/.env
# Edit packages/server/.env with your values
```

### 3. Refactor API Routes

The API routes have been moved to `packages/server/src/api/` but still need to be converted from Next.js format to Hono format.

**Example conversion:**

**Before** (Next.js API route):
```typescript
// app/api/airtable/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const data = await fetchFromAirtable();
  return NextResponse.json(data);
}
```

**After** (Hono route):
```typescript
// packages/server/src/api/airtable.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  const data = await fetchFromAirtable();
  return c.json(data);
});

export default app;
```

Then import in `packages/server/src/index.ts`:
```typescript
import airtableRoutes from './api/airtable';
app.route('/api/airtable', airtableRoutes);
```

### 4. Update Client API Calls

Update all `fetch` calls in the client to use the server URL:

```typescript
// Before
const response = await fetch('/api/airtable');

// After
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const response = await fetch(`${API_URL}/api/airtable`);
```

Or create a utility function:

```typescript
// packages/client/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiCall(endpoint: string, options?: RequestInit) {
  return fetch(`${API_URL}${endpoint}`, options);
}

// Usage
const response = await apiCall('/api/airtable');
```

### 5. Handle NextAuth

NextAuth needs special consideration since it requires server-side functionality. You have two options:

**Option A: Keep NextAuth in Next.js**
- Keep auth API routes in `packages/client/app/api/auth/`
- This is simpler but means not all API logic is centralized

**Option B: Move to separate auth service**
- Implement authentication in the Hono server
- Use JWT tokens for client-server communication
- More complex but fully separates concerns

### 6. Update Import Paths

The `@/*` path alias now points to the package root, not the monorepo root.

In **client** code:
```typescript
// Before: import from '@/components/...'
// After: Still works, but now relative to packages/client/
import Component from '@/components/Component';
```

In **server** code:
```typescript
// Before: import from '@/lib/...'
// After: Now relative to packages/server/src/
import { airtable } from '@/lib/airtable';
```

### 7. Test the Setup

```bash
# Terminal 1: Start the server
bun run dev:server

# Terminal 2: Start the client
bun run dev:client

# Or run both at once
bun run dev:all
```

Visit:
- Client: http://localhost:3000
- Server: http://localhost:3001
- Health check: http://localhost:3001/health

## Benefits of This Architecture

1. **Clear Separation**: Frontend and backend are completely separated
2. **Independent Deployment**: Can deploy client and server separately
3. **Better Performance**: Bun is significantly faster than Node.js
4. **Type Safety**: Can create shared types package if needed
5. **Scalability**: Easier to scale frontend and backend independently
6. **Development Speed**: Hot reload on both client and server

## Common Issues & Solutions

### Issue: API calls failing with CORS errors

**Solution:** The server has CORS middleware configured. Make sure:
1. `CLIENT_URL` is set correctly in server `.env`
2. Credentials are properly handled in fetch calls

### Issue: Environment variables not loading

**Solution:**
- Client env vars must start with `NEXT_PUBLIC_` to be accessible in browser
- Server env vars are loaded automatically by Bun
- Restart dev servers after changing env files

### Issue: Import paths broken

**Solution:**
- Update `tsconfig.json` paths if needed
- Remember `@/*` is now relative to each package
- Use relative imports for local files: `import './utils'`

## Rollback Plan

If you need to rollback:

1. The original files are still in the root directory (`app/`, `components/`, etc.)
2. You can revert to npm by running `npm install`
3. Change scripts in root `package.json` back to npm commands

## Questions?

Refer to:
- [README.md](./README.md) - Setup and usage
- [CLAUDE.md](./CLAUDE.md) - Architecture details
- Hono docs: https://hono.dev/
- Bun docs: https://bun.sh/docs
