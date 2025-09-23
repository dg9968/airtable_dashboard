# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint on codebase

## Architecture Overview

This is a Next.js 15 App Router application serving as a business management dashboard for tax preparation services. The system integrates with Airtable as the primary database and uses NextAuth.js for authentication.

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
```
AIRTABLE_PERSONAL_ACCESS_TOKEN
AIRTABLE_BASE_ID  
AIRTABLE_USERS_TABLE=Users
NEXTAUTH_SECRET
NEXTAUTH_URL
```

### Key Directories
- `/app` - Next.js App Router pages and API routes
- `/components` - Reusable React components
- `/lib` - Utility libraries (auth, airtable, googleDrive)
- Styling uses global CSS with Tailwind and component-level styling

### Development Notes
- Uses TypeScript with strict mode enabled
- Path alias `@/*` maps to project root
- Image optimization configured for YouTube thumbnails
- Deployment configured for Render.com with specific build/start commands