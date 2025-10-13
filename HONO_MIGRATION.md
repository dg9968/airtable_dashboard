# Hono Migration Guide

## ✅ Migration Progress

### Completed Routes

1. **✅ /api/airtable** - Airtable data fetching and updates
2. **✅ /api/documents** - Document upload, retrieval, and deletion

### Architecture Improvements

We've refactored the server with clean architecture principles:

```
packages/server/src/
├── routes/              # Hono route handlers
│   ├── airtable.ts     ✅ Migrated
│   └── documents.ts    ✅ Migrated
├── services/           # Business logic layer
│   └── documentService.ts  # Document management logic
├── utils/              # Helper utilities
│   └── helpers.ts      # Validation and utility functions
├── airtable.ts         # Airtable SDK wrapper
├── auth.ts             # Authentication utilities
├── googleDrive.ts      # Google Drive integration
└── index.ts            # Hono server entry point
```

---

## 📋 Migrated Routes

### 1. Airtable Routes

**File:** `packages/server/src/routes/airtable.ts`

**Endpoints:**
- `GET /api/airtable` - Fetch all tables and their data
- `POST /api/airtable` - Update Airtable data

**Key Changes:**
- ✅ Converted from Next.js API route to Hono
- ✅ Clean error handling with proper status codes
- ✅ Improved code organization
- ✅ Better error messages and suggestions

**Usage Example:**
```typescript
// Client code
import { apiGet } from '@/lib/api';

const data = await apiGet('/api/airtable');
```

### 2. Documents Routes

**File:** `packages/server/src/routes/documents.ts`
**Service:** `packages/server/src/services/documentService.ts`

**Endpoints:**
- `GET /api/documents` - Get documents by client code and tax year
- `POST /api/documents` - Upload a new document
- `DELETE /api/documents` - Delete a document by ID
- `GET /api/documents/generate-code` - Generate unique client code

**Key Changes:**
- ✅ Business logic extracted to service layer
- ✅ Validation extracted to helper utilities
- ✅ Cleaner route handlers
- ✅ Better separation of concerns
- ✅ Reusable document management functions

**Usage Example:**
```typescript
// Get documents
const docs = await apiGet('/api/documents?clientCode=1234&taxYear=2024');

// Upload document
const formData = new FormData();
formData.append('file', file);
formData.append('clientCode', '1234');
formData.append('taxYear', '2024');
const result = await apiUpload('/api/documents', file, { clientCode: '1234', taxYear: '2024' });

// Delete document
await apiDelete(`/api/documents?recordId=${recordId}`);

// Generate code
const { clientCode } = await apiGet('/api/documents/generate-code');
```

---

## 🏗️ Architecture Patterns

### Service Layer Pattern

Business logic is now separated into services:

```typescript
// services/documentService.ts
export async function saveDocument(
  file: File,
  clientCode: string,
  taxYear: string,
  uploadedBy: string
): Promise<{ id: string; fileName: string }> {
  // Complex logic here
}
```

**Benefits:**
- ✅ Reusable across multiple routes
- ✅ Easier to test
- ✅ Cleaner route handlers
- ✅ Single responsibility principle

### Helper Utilities Pattern

Common validations and utilities:

```typescript
// utils/helpers.ts
export function isValidClientCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim());
}

export function isValidFileSize(size: number, maxSizeMB: number = 10): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}
```

**Benefits:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Consistent validation across routes
- ✅ Easy to update validation rules
- ✅ Better testability

### Error Handling Pattern

Consistent error responses:

```typescript
try {
  // Logic here
  return c.json({ success: true, data });
} catch (error) {
  console.error('Error:', error);
  return c.json({ error: 'Internal server error' }, 500);
}
```

**Benefits:**
- ✅ Consistent error format
- ✅ Proper HTTP status codes
- ✅ Helpful error messages
- ✅ Client-friendly responses

---

## 🔄 Migration Pattern

### Before (Next.js API Route)

```typescript
// app/api/airtable/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### After (Hono Route)

```typescript
// packages/server/src/routes/airtable.ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const data = await fetchData();
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed' }, 500);
  }
});

export default app;
```

### Key Differences

| Next.js | Hono | Notes |
|---------|------|-------|
| `NextResponse.json(data)` | `c.json(data)` | Simpler API |
| `{ status: 500 }` | `500` | Status as second parameter |
| Export functions | Export Hono app | Better modularity |
| No middleware control | Full middleware control | More flexible |

---

## 📝 Remaining Routes to Migrate

### High Priority

1. **bank-statement-processing** (3 routes)
   - `GET /api/bank-statement-processing`
   - `GET /api/bank-statement-processing/status`
   - `GET /api/bank-statement-processing/download`

2. **customer-subscriptions**
   - `GET /api/customer-subscriptions`
   - `POST /api/customer-subscriptions`

### Medium Priority

3. **processor-billing**
4. **services**
5. **subscriptions**
6. **youtube-videos**

### Low Priority

7. **diagnostic**
8. **test**
9. **view**
10. **tables**

### Do Not Migrate (Keep in Client)

- ❌ **auth/** - Keep in Next.js client (NextAuth integration)

---

## 🚀 How to Migrate a Route

### Step 1: Analyze the Route

Read the existing Next.js route:
```bash
cat packages/server/src/api/ROUTE_NAME/route.ts
```

Identify:
- What HTTP methods (GET, POST, DELETE, etc.)
- What business logic
- What dependencies
- What validations

### Step 2: Extract Business Logic (if needed)

If the route has complex logic, create a service:

```typescript
// packages/server/src/services/myService.ts
export async function doSomething(params) {
  // Complex logic here
  return result;
}
```

### Step 3: Create Hono Route

```typescript
// packages/server/src/routes/myRoute.ts
import { Hono } from 'hono';
import { doSomething } from '../services/myService';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const param = c.req.query('param');

    if (!param) {
      return c.json({ error: 'Parameter required' }, 400);
    }

    const result = await doSomething(param);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
```

### Step 4: Register in Server Index

```typescript
// packages/server/src/index.ts
import myRoutes from './routes/myRoute';

app.route('/api/my-route', myRoutes);
```

### Step 5: Test the Route

```bash
# Start server
bun run dev:server

# Test endpoint
curl http://localhost:3001/api/my-route
```

### Step 6: Update Client Calls

```typescript
// Client code
import { apiGet } from '@/lib/api';

const data = await apiGet('/api/my-route?param=value');
```

---

## 🧪 Testing Migrated Routes

### Manual Testing

```bash
# Health check
curl http://localhost:3001/health

# Airtable
curl http://localhost:3001/api/airtable

# Documents
curl "http://localhost:3001/api/documents?clientCode=1234&taxYear=2024"

# Generate client code
curl http://localhost:3001/api/documents/generate-code
```

### From Client

Update your client code to use the API utilities:

```typescript
import { apiGet, apiPost, apiDelete } from '@/lib/api';

// Instead of:
fetch('/api/airtable')

// Use:
apiGet('/api/airtable')
```

---

## 📊 Progress Tracking

### Completed ✅

- [x] Project structure setup
- [x] Helper utilities created
- [x] Service layer pattern established
- [x] Airtable routes migrated
- [x] Documents routes migrated
- [x] Server index updated
- [x] Error handling improved

### In Progress 🔄

- [ ] Bank statement processing routes
- [ ] Customer subscriptions routes
- [ ] Remaining routes migration

### To Do ⏳

- [ ] Add authentication middleware
- [ ] Add request validation middleware
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add automated tests
- [ ] Performance optimization

---

## 🎯 Benefits Achieved

### Code Quality
- ✅ **Cleaner Code:** Separation of concerns
- ✅ **Reusability:** Service layer can be used anywhere
- ✅ **Maintainability:** Easier to update and fix
- ✅ **Testability:** Services can be unit tested

### Performance
- ✅ **Faster:** Bun is 2-3x faster than Node.js
- ✅ **Less Memory:** More efficient runtime
- ✅ **Hot Reload:** Instant updates during development

### Developer Experience
- ✅ **Better Errors:** More helpful error messages
- ✅ **Type Safety:** Full TypeScript support
- ✅ **Modern API:** Cleaner Hono API vs Next.js
- ✅ **Flexibility:** Full control over middleware and routing

---

## 📚 Related Documentation

- [NEXT_STEPS.md](./NEXT_STEPS.md) - Original migration guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SUCCESS.md](./SUCCESS.md) - What's working

---

## 🆘 Troubleshooting

### "Module not found"
```bash
bun install
```

### "Port already in use"
```bash
ps aux | grep bun | awk '{print $2}' | xargs kill -9
```

### Routes returning 404
- Check route is registered in `src/index.ts`
- Check endpoint path matches
- Restart server

### TypeScript errors
- Check imports are correct
- Run `bun install` to update types
- Restart TypeScript server in your editor

---

**Next Steps:** Continue migrating remaining routes following the patterns established!

**Start with:** Bank statement processing routes (high priority for business operations)
