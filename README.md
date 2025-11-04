# Airtable Dashboard - Monorepo

A business management dashboard for tax preparation services built with Next.js and Bun.

> **📖 New to this project?** Start with [INDEX.md](./INDEX.md) for a guide to all documentation, or jump to [QUICKSTART.md](./QUICKSTART.md) to run the project immediately.

## 📦 Project Structure

This is a Bun monorepo with the following packages:

```
├── packages/
│   ├── client/          # Next.js 15 frontend application
│   └── server/          # Bun + Hono API server
```

## 📚 Documentation

- **[INDEX.md](./INDEX.md)** - Documentation guide and navigation
- **[QUICKSTART.md](./QUICKSTART.md)** - Fast setup and run commands
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - Complete the API migration
- **[STATUS.md](./STATUS.md)** - Current project status
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and diagrams
- **[MIGRATION.md](./MIGRATION.md)** - Detailed migration examples

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- Node.js v20+ (for Next.js compatibility)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

### Development

Run both client and server in development mode:

```bash
# Run client only (Next.js)
bun run dev

# Run server only (Bun + Hono)
bun run dev:server

# Run both in parallel
bun run dev:all
```

The client will be available at `http://localhost:3000` and the server at `http://localhost:3001`.

### Environment Setup

1. Copy environment files:

```bash
cp packages/client/.env.example packages/client/.env.local
cp packages/server/.env.example packages/server/.env
```

2. Fill in your configuration values in both `.env.local` and `.env` files.

### Building for Production

```bash
# Build both packages
bun run build

# Build individually
bun run build:client
bun run build:server
```

### Running Production Build

```bash
bun run start
```

## 📁 Package Details

### Client (`packages/client`)

- **Framework**: Next.js 15 with App Router
- **UI**: React 19, Tailwind CSS, DaisyUI
- **Auth**: NextAuth.js
- **Visualization**: Mermaid diagrams

**Scripts:**
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint

### Server (`packages/server`)

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: Airtable
- **Storage**: AWS S3, Google Drive
- **Auth**: bcryptjs for password hashing

**Scripts:**
- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint

## 🔧 Key Features

- **Authentication**: Role-based access control (admin, staff, user)
- **Airtable Integration**: Primary database with Personal Access Token auth
- **Document Management**: File upload and Google Drive integration
- **Bank Statement Processing**: Financial document workflows
- **Billing Management**: Processor billing and client management
- **Training Resources**: YouTube video integration
- **Filing Deadlines**: Tax deadline tracking
- **Cloud Backup**: OneDrive to Google Drive automated backup script

## 🔄 Backup Scripts

The server includes a backup script to automatically sync files from OneDrive to Google Drive:

```bash
# From packages/server directory

# Test what would be backed up (dry run)
npm run backup:onedrive:dry-run

# Run the backup
npm run backup:onedrive
```

**Features:**
- Preserves folder structure
- Incremental backups (updates existing files)
- Supports file exclusion patterns
- Works with personal and organizational OneDrive accounts
- Can be scheduled for automated backups

📖 **[Full Setup Guide](./docs/ONEDRIVE_BACKUP_SETUP.md)** - Complete instructions for Azure AD and Google Cloud setup

## 📝 Available Scripts

From the root directory:

- `bun run dev` - Start client development server
- `bun run dev:client` - Start client only
- `bun run dev:server` - Start server only
- `bun run dev:all` - Start both client and server in parallel
- `bun run build` - Build both packages
- `bun run start` - Start production server
- `bun run lint` - Lint both packages
- `bun run clean` - Remove all node_modules and build artifacts

## 🌐 Deployment

This application is configured for deployment on [Render.com](https://render.com).

### Environment Variables Required

**Client:**
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_API_URL`

**Server:**
- `PORT`
- `CLIENT_URL`
- `AIRTABLE_PERSONAL_ACCESS_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_USERS_TABLE`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `GOOGLE_DRIVE_CREDENTIALS_JSON`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_BACKUP_FOLDER_ID` (for OneDrive backups)
- `ONEDRIVE_CLIENT_ID` (optional, for backup script)
- `ONEDRIVE_CLIENT_SECRET` (optional, for backup script)
- `ONEDRIVE_TENANT_ID` (optional, for backup script)

## 📚 Tech Stack

- **Runtime**: Bun
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Hono, Bun
- **Database**: Airtable
- **Storage**: AWS S3, Google Drive API
- **Styling**: Tailwind CSS, DaisyUI
- **Authentication**: NextAuth.js
- **Diagrams**: Mermaid

## 📖 Documentation

For more detailed information, see [CLAUDE.md](./CLAUDE.md) which contains development guidelines and architecture details.

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Private - All rights reserved
