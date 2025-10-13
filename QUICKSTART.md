# Quick Start Guide

## ✅ What's Been Done

Your project has been successfully refactored into a Bun monorepo with:
- ✅ Separate client (Next.js) and server (Bun + Hono) packages
- ✅ Workspace configuration with proper dependency management
- ✅ Environment files for both packages
- ✅ Working server with health check endpoint
- ✅ All files properly organized and configured

## 🚀 Getting Started

### 1. Install Dependencies (Already Done!)

```bash
bun install
```

### 2. Set Up Environment Variables

**Client environment:**
```bash
cp packages/client/.env.example packages/client/.env.local
```

Edit `packages/client/.env.local`:
```env
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Server environment:**
```bash
cp packages/server/.env.example packages/server/.env
```

Edit `packages/server/.env`:
```env
PORT=3001
CLIENT_URL=http://localhost:3000
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token_here
AIRTABLE_BASE_ID=your_base_id_here
# ... add other variables
```

### 3. Run Development Servers

**Option A: Run both together** (Recommended)
```bash
bun run dev:all
```

**Option B: Run separately** (for debugging)

Terminal 1 - Server:
```bash
bun run dev:server
```

Terminal 2 - Client:
```bash
bun run dev:client
```

### 4. Verify Everything Works

- **Server**: http://localhost:3001/health (should return `{"status":"ok"}`)
- **Client**: http://localhost:3000

## 📝 Available Commands

```bash
# Development
bun run dev          # Start client only
bun run dev:client   # Start client only
bun run dev:server   # Start server only
bun run dev:all      # Start both in parallel

# Building
bun run build        # Build both packages
bun run build:client # Build client
bun run build:server # Build server

# Production
bun run start        # Start production client

# Linting
bun run lint         # Lint both packages

# Cleanup
bun run clean        # Remove all build artifacts and dependencies
```

## ⚠️ Next Steps to Complete Migration

The structure is ready, but you need to:

### 1. Convert API Routes to Hono

API routes are in `packages/server/src/api/` but still use Next.js format. Convert them to Hono:

**Example:**
```typescript
// packages/server/src/api/airtable.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  // Your logic here
  return c.json({ data: 'your data' });
});

export default app;
```

Then register in `packages/server/src/index.ts`:
```typescript
import airtableRoutes from './api/airtable';
app.route('/api/airtable', airtableRoutes);
```

### 2. Update Client API Calls

Replace direct API calls with server URL:

```typescript
// Before
fetch('/api/airtable')

// After
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
fetch(`${API_URL}/api/airtable`)
```

Or create a helper:
```typescript
// packages/client/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiCall(endpoint: string, options?: RequestInit) {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // for cookies/auth
  });
}
```

### 3. Handle Authentication

NextAuth currently expects API routes in Next.js. Options:
- **Easy**: Keep NextAuth routes in `packages/client/app/api/auth/`
- **Better**: Migrate auth to server with JWT tokens

## 🧪 Testing Your Setup

1. **Server health check:**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. **Check if client loads:**
   ```bash
   bun run dev:client
   # Visit http://localhost:3000
   ```

3. **Run both together:**
   ```bash
   bun run dev:all
   # Both should start without errors
   ```

## 📚 Documentation

- [README.md](./README.md) - Full documentation
- [MIGRATION.md](./MIGRATION.md) - Detailed migration guide
- [CLAUDE.md](./CLAUDE.md) - Architecture details

## 🆘 Common Issues

**Issue: Port already in use**
```bash
# Find and kill process on port 3001 (server)
lsof -ti:3001 | xargs kill -9

# Or port 3000 (client)
lsof -ti:3000 | xargs kill -9
```

**Issue: Environment variables not loading**
- Make sure files are named `.env.local` (client) and `.env` (server)
- Restart dev servers after changing env files
- Client vars must start with `NEXT_PUBLIC_` for browser access

**Issue: Can't find module**
```bash
# Reinstall dependencies
bun run clean
bun install
```

## 🎉 You're Ready!

Your monorepo is set up and working. Start by:
1. Setting up your environment variables
2. Converting one API route to Hono as a test
3. Updating the corresponding client code to use it

Good luck! 🚀
