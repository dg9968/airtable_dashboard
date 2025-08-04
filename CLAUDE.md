# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

Development server runs on http://localhost:3000

## Architecture Overview

This is a Next.js 15 application for tax preparation business management with Airtable integration. Key architectural components:

### Core Technology Stack
- **Next.js 15** with App Router architecture
- **NextAuth.js** for authentication with role-based access control
- **Airtable API** for data management and storage
- **DaisyUI + Tailwind CSS** for UI components and styling
- **TypeScript** for type safety

### Authentication System
- Credential-based auth with role hierarchy: `admin` > `staff` > `user`
- Mock users defined in `lib/auth.ts` with plaintext passwords for development
- Protected routes handled by `middleware.ts` with role-based access control
- Admin routes (`/admin/*`) restricted to admin role only
- Staff routes (`/airtable*`, `/view-display*`, `/processor-billing*`) require staff or admin

### Airtable Integration
- Centralized in `lib/airtable.ts`
- Uses Personal Access Token authentication (not deprecated API key)
- Provides functions for:
  - Connection testing (`testConnection()`)
  - Base schema retrieval (`getBaseSchema()`)
  - Generic table data fetching (`fetchTableData()`, `fetchAllTableData()`)
  - Data analysis (`analyzeTableData()`)
- API routes in `app/api/` provide server-side Airtable integration

### Page Structure
- **Home** (`/`): Public landing page via `HomePage` component
- **Dashboard** (`/dashboard`): Main authenticated user interface
- **Calendar** (`/calendar`): Service task calendar view
- **Admin** (`/admin`): Administrative functions (admin-only)
- **Specialized Views**: 
  - `/airtable-dashboard`: Airtable data visualization
  - `/processor-billing`: Billing management
  - `/view-display`: Data display interface
  - `/training-videos`: Public training content

### Component Architecture
- Layout defined in `app/layout.tsx` with theme wrapper
- Reusable components in `components/` directory
- Client-side theme management via `ClientThemeWrapper`
- Header/Footer layout with responsive design

### Environment Configuration
Required environment variables in `.env.local`:
- `AIRTABLE_PERSONAL_ACCESS_TOKEN`: Airtable API authentication
- `AIRTABLE_BASE_ID`: Target Airtable base identifier
- `NEXTAUTH_SECRET`: NextAuth session encryption key

### Theming System
- DaisyUI themes with extensive theme selection (26+ themes)
- Default theme: "winter"
- Theme switching capability built into components
- Dark theme support with "dark" as darkTheme setting

## Important Development Notes

### Airtable API Pattern
Always use the centralized functions in `lib/airtable.ts` rather than direct API calls. The library handles:
- Environment validation
- Error handling with descriptive messages
- Connection testing
- Pagination for large datasets

### Authentication Flow
1. Users sign in via `/auth/signin`
2. Credentials validated against mock users in `lib/auth.ts`
3. JWT tokens include role information
4. Middleware intercepts requests and validates access based on role and route

### Role-Based Access
- Public routes: `/`, `/training-videos`, `/auth/*`
- User routes: `/dashboard` (any authenticated user)
- Staff routes: `/airtable*`, `/view-display*`, `/processor-billing*`
- Admin routes: `/admin*`

### Development Authentication
Current mock users for testing:
- `admin@example.com` / `password123` (admin role)
- `staff@example.com` / `password123` (staff role)  
- `user@example.com` / `password123` (user role)