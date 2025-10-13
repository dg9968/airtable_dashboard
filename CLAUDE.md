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

This is a **Bun monorepo** with separate client and server packages. The client is a Next.js 15 App Router application, and the server is a Bun + Hono API. The system serves as a business management dashboard for tax preparation services, integrating with Airtable as the primary database and using NextAuth.js for authentication.

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
        ├── api/    # API route handlers (from Next.js API routes)
        ├── lib/    # Utility libraries (auth, airtable, googleDrive)
        └── index.ts # Server entry point
```

### Authentication & Authorization
- NextAuth.js with credentials provider using Airtable for user storage
- Role-based access control: `admin`, `staff`, `user`
- Middleware handles route protection with role-specific restrictions
- Password hashing using bcryptjs
- User data stored in Airtable Users table

### Data Management
- **Airtable Integration**: Primary database using Personal Access Token authentication
- **Google Drive API**: Document management and file operations
- **AWS S3**: File storage for document uploads
- Configuration handled via environment variables in production (Render.com)

### UI Framework
- **Tailwind CSS** with **DaisyUI** component library
- Multiple theme support with dynamic theme switching
- Responsive design using CSS Grid and Flexbox
- Client-side theme management with local storage persistence

### Key Application Features
1. **Dashboard**: Overview with stats and recent activity
2. **Airtable Dashboard**: Direct Airtable data visualization
3. **Document Management**: File upload, storage, and Google Drive integration
4. **Bank Statement Processing**: Financial document processing workflows
5. **Processor Billing**: Service billing and client management
6. **Training Videos**: YouTube video integration for staff training
7. **Filing Deadlines**: Tax deadline tracking and management

### Route Structure
- `/` - Public home page
- `/dashboard` - Main authenticated dashboard
- `/admin` - Admin-only section
- `/airtable-dashboard`, `/view-display`, `/document-management` - Staff/Admin only
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
AIRTABLE_PERSONAL_ACCESS_TOKEN
AIRTABLE_BASE_ID
AIRTABLE_USERS_TABLE=Users
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
GOOGLE_DRIVE_CREDENTIALS_JSON
GOOGLE_DRIVE_FOLDER_ID
```

### Development Notes
- Uses **Bun** as the runtime and package manager
- **Client**: Next.js 15 with TypeScript strict mode, path alias `@/*` maps to client root
- **Server**: Bun + Hono framework with hot reload for fast development
- Styling uses global CSS with Tailwind and component-level styling
- Image optimization configured for YouTube thumbnails
- Deployment configured for Render.com with specific build/start commands
- API routes migrated from Next.js API routes to Hono server routes