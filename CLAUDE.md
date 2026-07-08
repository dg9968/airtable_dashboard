# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun run dev` - Start client development server on http://localhost:3000
- `bun run dev:server` - Start API server on http://localhost:3001
- `bun run dev:all` - Start both client and server in parallel
- `bun run build` - Build both packages for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint on both packages

## Architecture Overview

This is a **Bun monorepo** with separate client and server packages. The client is a Next.js 15 App Router application, and the server is a Bun + Hono API. The system serves as a business management dashboard for tax preparation services. The database is Postgres (Drizzle ORM), and the client uses Better Auth for authentication.

### Monorepo Structure

```
packages/
├── client/          # Next.js 15 frontend
│   ├── app/        # Next.js App Router pages and layouts
│   ├── components/ # Reusable React components
│   ├── hooks/      # Custom React hooks
│   └── public/     # Static assets
└── server/          # Bun + Hono API
    └── src/
        ├── routes/ # API route handlers, one file per resource
        ├── db/     # Drizzle schema (db/schema/), client, serializers
        ├── lib/    # Utility libraries (googleDrive, template-engine, family-record-helpers)
        └── index.ts # Server entry point
```

### Authentication & Authorization
- Better Auth (client-side), backed by Postgres `user`/`session`/`account`/`verification` tables
- Role-based access control: `admin`, `staff`, `user`
- Middleware handles route protection with role-specific restrictions
- Password hashing using bcryptjs

### Data Management
- **Postgres** (Render-hosted): primary database, owned via Drizzle ORM — see "Database" below
- **Google Drive API**: document/file storage; Postgres stores only metadata + Drive file IDs
- **AWS S3**: bank-statement file storage
- Configuration handled via environment variables in production (Render.com)

### UI Framework
- **Tailwind CSS** with **DaisyUI** component library
- Multiple theme support with dynamic theme switching
- Responsive design using CSS Grid and Flexbox
- Client-side theme management with local storage persistence

### Key Application Features
1. **Dashboard**: Overview with stats and recent activity
2. **Document Management**: File upload, storage, and Google Drive integration
3. **Bank Statement Processing**: Financial document processing workflows
4. **Processor Billing**: Service billing and client management
5. **Training Videos**: YouTube video integration for staff training
6. **Filing Deadlines**: Tax deadline tracking and management

### Route Structure
- `/` - Public home page
- `/dashboard` - Main authenticated dashboard
- `/admin` - Admin-only section
- `/airtable-dashboard`, `/document-management` - Staff/Admin only (name is historical; data is Postgres)
- `/training-videos` - Public access
- API routes in `/api/` for backend operations

### Environment Variables Required

**Client (packages/client/.env.local):**
```
NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Server (packages/server/.env):**
```
PORT=3001
CLIENT_URL=http://localhost:3000
DATABASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
GOOGLE_DRIVE_CREDENTIALS_JSON
GOOGLE_DRIVE_FOLDER_ID
```
`AIRTABLE_PERSONAL_ACCESS_TOKEN` / `AIRTABLE_BASE_ID` are no longer read at runtime — only kept for `packages/server/scripts/etl/*.ts` if a corrective re-import or final export is ever needed.

### Development Notes
- Uses **Bun** as the runtime and package manager
- **Client**: Next.js 15 with TypeScript strict mode, path alias `@/*` maps to client root
- **Server**: Bun + Hono framework with hot reload for fast development
- Styling uses global CSS with Tailwind and component-level styling
- Image optimization configured for YouTube thumbnails
- Deployment configured for Render.com with specific build/start commands
- API routes migrated from Next.js API routes to Hono server routes

### Adding New Server Routes
Register new route files from `packages/server/src/routes/` in **`packages/server/src/app.ts`** — the single shared Hono app. The entry points (`src/index.ts` for Bun dev, `src/node-server.ts` for production/Render) are thin wrappers around it and must not register routes themselves.

### Database
Postgres (Render-hosted, `DATABASE_URL`), shared with the client's Better Auth. Drizzle ORM owns the business schema in `packages/server/src/db/schema/`; migrations via `bun run db:generate` + `bun run db:migrate` (**never** `drizzle-kit push` — the DB also holds Better Auth tables owned by `packages/client/scripts/run-migrations.ts`). `packages/server/src/db/client.ts` exports `getDb()`.

The app was migrated off Airtable in 2026 (six phases: catalogs → entities → subscriptions/billing → documents/tax-notices → communications/signing → retirement). Historical ETL scripts (`packages/server/scripts/etl/phase*.ts`) preserved Airtable `rec...` IDs as Postgres text primary keys — every business record's ID is still the original Airtable record ID. Some routes still return legacy Airtable-shaped JSON (`{ id, fields: {...}, createdTime }`) via compat serializers in `packages/server/src/db/serializers*.ts`, to avoid a client-side rewrite; new routes should not follow this shape.