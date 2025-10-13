# Next Steps - Completing the Migration

## Current Situation

✅ **What's Working:**
- Monorepo structure is set up
- Client and server packages are configured
- Server runs successfully on port 3001
- Dependencies are installed

⚠️ **What Needs Fixing:**
- Client is trying to call `/api/auth/*` but getting 404s
- API routes exist in `packages/server/src/api/` but aren't registered with Hono
- NextAuth expects to run in Next.js

## 🎯 Recommended Approach: Hybrid Setup

Keep NextAuth in Next.js, move other APIs to Hono server.

### Option A: Keep NextAuth in Next.js (Recommended)

This is the **simplest and fastest** approach since NextAuth is tightly integrated with Next.js.

#### Steps:

**1. Move NextAuth back to client:**

```bash
# Move auth routes back to client
cp -r packages/server/src/api/auth packages/client/app/api/
```

**2. Update your client to call local auth, remote APIs:**

```typescript
// packages/client/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// For auth - use local Next.js routes
export async function authCall(endpoint: string, options?: RequestInit) {
  return fetch(endpoint, options); // Local, e.g., /api/auth/session
}

// For other APIs - use Hono server
export async function apiCall(endpoint: string, options?: RequestInit) {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
  });
}
```

**3. Keep these in Next.js client:**
- `/api/auth/*` - NextAuth routes (authentication)

**4. Migrate to Hono server:**
- All other API routes (Airtable, documents, bank processing, etc.)

### Option B: Full Migration (Advanced)

Move authentication to the Hono server. More work but cleaner separation.

**Not recommended for now** - stick with Option A first.

---

## 📝 Step-by-Step: Implementing Option A

### Step 1: Restore NextAuth to Client

```bash
# Create API directory in client if it doesn't exist
mkdir -p packages/client/app/api

# Move auth routes back
cp -r packages/server/src/api/auth packages/client/app/api/

# Remove from server
rm -rf packages/server/src/api/auth
```

### Step 2: Convert One API Route to Hono (Example)

Let's convert the Airtable route as an example:

**Check the existing route:**
```bash
cat packages/server/src/api/airtable/route.ts
```

**Create Hono version:**
```typescript
// packages/server/src/routes/airtable.ts
import { Hono } from 'hono';
import { getAirtableRecords } from '../lib/airtable';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const records = await getAirtableRecords();
    return c.json(records);
  } catch (error) {
    console.error('Airtable error:', error);
    return c.json({ error: 'Failed to fetch records' }, 500);
  }
});

app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    // Handle POST logic
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to create record' }, 500);
  }
});

export default app;
```

**Register in server:**
```typescript
// packages/server/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import airtableRoutes from './routes/airtable';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.route('/api/airtable', airtableRoutes);

const port = process.env.PORT || 3001;

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

### Step 3: Update Client to Use Server API

```typescript
// packages/client/app/airtable-dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AirtableDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/airtable`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

### Step 4: Fix Library Imports in Server

The server's `lib/` files (airtable, auth, googleDrive) are now in `packages/server/src/` so update imports:

```typescript
// In packages/server/src/routes/airtable.ts
import { getAirtableRecords } from '../airtable'; // Not '../lib/airtable'
```

---

## 🧪 Testing Your Changes

### Test 1: Auth Works Locally
```bash
# Start client
bun run dev:client

# Visit http://localhost:3000
# Try logging in - auth should work
```

### Test 2: Server API Works
```bash
# In another terminal, start server
bun run dev:server

# Test the endpoint
curl http://localhost:3001/api/airtable
```

### Test 3: Client Calls Server
```bash
# With both running
bun run dev:all

# Visit a page that calls the Airtable API
# Check browser console for errors
```

---

## 📋 Routes to Migrate

Here's what to migrate to Hono (in order of priority):

### High Priority (Core functionality)
1. ✅ `/api/airtable` - Airtable data fetching
2. ✅ `/api/documents/*` - Document management
3. ✅ `/api/bank-statement-processing/*` - Bank processing

### Medium Priority
4. `/api/customer-subscriptions` - Subscriptions
5. `/api/csv-to-qbo` - CSV conversion

### Low Priority
6. `/api/diagnostic` - Diagnostics
7. Other utility routes

### Keep in Next.js
- ✅ `/api/auth/*` - NextAuth (keep in client)

---

## 🔍 Quick Commands Reference

```bash
# Start both services
bun run dev:all

# Just client
bun run dev:client

# Just server
bun run dev:server

# Check server health
curl http://localhost:3001/health

# Test an API endpoint
curl http://localhost:3001/api/airtable
```

---

## 🆘 Troubleshooting

### "Port already in use"
```bash
# Windows: Use Task Manager to kill bun processes
# Or restart your terminal
```

### "Cannot find module"
Check your imports - paths changed:
- Before: `import { x } from '@/lib/y'`
- After in server: `import { x } from '../y'`

### "CORS error"
Make sure `CLIENT_URL` is set correctly in `packages/server/.env`:
```env
CLIENT_URL=http://localhost:3000
```

---

## ✅ Success Checklist

- [ ] Auth routes moved back to `packages/client/app/api/auth/`
- [ ] At least one API route converted to Hono and working
- [ ] Client can call server API successfully
- [ ] Both servers run without errors with `bun run dev:all`
- [ ] Authentication works
- [ ] No CORS errors in browser console

---

## 📚 Additional Resources

- [Hono Documentation](https://hono.dev/)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [MIGRATION.md](./MIGRATION.md) - Detailed migration examples

Need help? Check the existing routes in `packages/server/src/api/` for patterns to follow!
