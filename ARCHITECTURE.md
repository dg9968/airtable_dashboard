# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ HTTP Requests
                                 │
                    ┌────────────▼──────────────┐
                    │   Next.js Client :3000    │
                    │  (packages/client/)       │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  React Components   │  │
                    │  │  - Dashboard        │  │
                    │  │  - Bank Processing  │  │
                    │  │  - Documents        │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  NextAuth           │  │
                    │  │  /api/auth/*        │  │
                    │  │  (Local Auth)       │  │
                    │  └─────────────────────┘  │
                    └────────────┬──────────────┘
                                 │
                                 │ API Calls
                                 │ (via lib/api.ts)
                                 │
                    ┌────────────▼──────────────┐
                    │   Hono Server :3001       │
                    │  (packages/server/)       │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  API Routes         │  │
                    │  │  /api/airtable      │  │
                    │  │  /api/documents     │  │
                    │  │  /api/bank-*        │  │
                    │  └─────────────────────┘  │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │  Business Logic     │  │
                    │  │  - airtable.ts      │  │
                    │  │  - googleDrive.ts   │  │
                    │  │  - auth.ts          │  │
                    │  └─────────────────────┘  │
                    └────────────┬──────────────┘
                                 │
                    ┌────────────┴──────────────┐
                    │                           │
           ┌────────▼────────┐      ┌──────────▼─────────┐
           │   Airtable      │      │   AWS S3           │
           │   (Database)    │      │   (File Storage)   │
           └─────────────────┘      └────────────────────┘
                    │
           ┌────────▼────────┐
           │  Google Drive   │
           │  (Documents)    │
           └─────────────────┘
```

## Request Flow

### Authentication Request

```
User Login
    │
    ├─→ POST /api/auth/signin
    │   (Next.js Client - Local)
    │
    ├─→ NextAuth validates credentials
    │   └─→ Check Airtable Users table
    │
    └─→ Session created
        └─→ Cookie set
```

### Data Request (e.g., Fetch Airtable Records)

```
Component Render
    │
    ├─→ apiGet('/api/airtable')
    │   (uses lib/api.ts)
    │
    ├─→ Fetch to http://localhost:3001/api/airtable
    │   (Hono Server)
    │
    ├─→ Hono route handler
    │   └─→ airtable.ts functions
    │       └─→ Airtable API call
    │
    └─→ JSON response
        └─→ Component updates
```

## File Organization

### Client Package (`packages/client/`)

```
client/
├── app/
│   ├── api/
│   │   └── auth/              ← NextAuth routes (local)
│   ├── dashboard/             ← Pages
│   ├── airtable-dashboard/
│   ├── bank-statement-processing/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Navbar.tsx
│   ├── StateDiagram.tsx
│   └── ...
├── hooks/
│   └── useAuth.ts
├── lib/
│   └── api.ts                 ← Server API utilities
├── public/
│   └── assets/
├── next.config.js
├── tailwind.config.ts
└── package.json
```

### Server Package (`packages/server/`)

```
server/
├── src/
│   ├── api/                   ← API routes (to be migrated)
│   │   ├── airtable/
│   │   ├── bank-statement-processing/
│   │   ├── documents/
│   │   └── ...
│   ├── routes/                ← NEW: Hono routes (create these)
│   │   ├── airtable.ts
│   │   ├── documents.ts
│   │   └── ...
│   ├── airtable.ts           ← Business logic
│   ├── googleDrive.ts
│   ├── auth.ts
│   └── index.ts              ← Server entry point
├── scripts/
└── package.json
```

## Data Flow Patterns

### Pattern 1: Simple GET Request

```typescript
// Client Component
import { apiGet } from '@/lib/api';

const data = await apiGet('/api/airtable');
```

```typescript
// Server Route (packages/server/src/routes/airtable.ts)
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  const records = await getAirtableRecords();
  return c.json(records);
});
```

### Pattern 2: POST with Data

```typescript
// Client Component
import { apiPost } from '@/lib/api';

const result = await apiPost('/api/documents', {
  name: 'file.pdf',
  folder: 'invoices'
});
```

```typescript
// Server Route
app.post('/', async (c) => {
  const body = await c.req.json();
  const result = await createDocument(body);
  return c.json(result);
});
```

### Pattern 3: File Upload

```typescript
// Client Component
import { apiUpload } from '@/lib/api';

const result = await apiUpload('/api/documents/upload', file, {
  folder: 'invoices',
  clientId: '123'
});
```

```typescript
// Server Route
app.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  const result = await uploadToS3(file);
  return c.json(result);
});
```

## Security Considerations

### Authentication

- **NextAuth** handles authentication locally in Next.js
- Session cookies are shared between client and server
- Server validates session via cookie or token

### CORS

- Server configured to accept requests from client origin
- Credentials (cookies) are included in requests
- `credentials: 'include'` in all API calls

### Environment Variables

**Client:**
- Prefixed with `NEXT_PUBLIC_` for browser access
- Non-prefixed vars are server-side only

**Server:**
- All env vars are server-side
- Never exposed to browser

## Deployment Architecture

### Development

```
Local Machine
├── Client: localhost:3000
└── Server: localhost:3001
```

### Production (Recommended: Render.com)

```
Render.com
├── Web Service 1: Client (Next.js)
│   └── Build: bun run build:client
│   └── Start: bun run start
│
└── Web Service 2: Server (Bun + Hono)
    └── Build: bun run build:server
    └── Start: bun run start

External Services:
├── Airtable (Database)
├── AWS S3 (File Storage)
└── Google Drive (Documents)
```

## Technology Stack

### Client
- **Framework:** Next.js 15 (App Router)
- **Runtime:** Node.js / Bun
- **UI:** React 19
- **Styling:** Tailwind CSS + DaisyUI
- **Auth:** NextAuth.js
- **Type Safety:** TypeScript

### Server
- **Runtime:** Bun
- **Framework:** Hono (fast web framework)
- **Auth:** bcryptjs for password hashing
- **APIs:**
  - Airtable SDK
  - AWS S3 SDK
  - Google Drive API

## Benefits of This Architecture

### 1. Separation of Concerns
- Frontend focuses on UI/UX
- Backend handles business logic and data

### 2. Independent Scaling
- Scale frontend and backend separately
- Can have multiple backend instances

### 3. Better Performance
- Bun is 2-3x faster than Node.js
- Hot reload on both services

### 4. Easier Development
- Changes to one service don't affect the other
- Can work on frontend without backend running (with mocks)

### 5. Deployment Flexibility
- Deploy to different platforms
- Use serverless for parts of the backend
- Easier to add microservices

## Migration Strategy

### Phase 1: Setup (✅ Complete)
- Create monorepo structure
- Configure workspaces
- Set up both packages

### Phase 2: API Migration (In Progress)
- Convert API routes to Hono
- Update client to use server APIs
- Test each route

### Phase 3: Testing
- End-to-end testing
- Authentication flow
- All features working

### Phase 4: Production
- Deploy to Render.com
- Configure environment variables
- Monitor and optimize

---

**Current Status:** Phase 1 complete, Phase 2 in progress

**Next Steps:** See [NEXT_STEPS.md](./NEXT_STEPS.md) for detailed instructions
