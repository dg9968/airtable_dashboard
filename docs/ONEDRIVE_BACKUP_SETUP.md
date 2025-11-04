# OneDrive to Google Drive Backup Script Setup Guide

This guide will walk you through setting up the OneDrive to Google Drive backup script, which automatically backs up files from Microsoft OneDrive to Google Drive.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Azure AD Setup (OneDrive)](#azure-ad-setup-onedrive)
4. [Google Cloud Setup (Google Drive)](#google-cloud-setup-google-drive)
5. [Environment Configuration](#environment-configuration)
6. [Running the Backup](#running-the-backup)
7. [Scheduling Automated Backups](#scheduling-automated-backups)
8. [Troubleshooting](#troubleshooting)

## Overview

The backup script:
- ✅ Preserves folder structure from OneDrive to Google Drive
- ✅ Supports incremental backups (updates existing files)
- ✅ Allows selective folder backup
- ✅ Provides dry-run mode for testing
- ✅ Supports file exclusion patterns
- ✅ Works with both personal and organizational OneDrive accounts

## Prerequisites

- Node.js/Bun installed
- Access to Azure Portal (for OneDrive)
- Access to Google Cloud Console (for Google Drive)
- Administrative access to OneDrive and Google Drive accounts

## Azure AD Setup (OneDrive)

### Step 1: Create an Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: `OneDrive to Google Drive Backup`
   - **Supported account types**: Choose based on your needs
     - **Single tenant**: For single organization
     - **Multi-tenant**: For multiple organizations
   - **Redirect URI**: Leave blank (not needed for service account)
5. Click **Register**

### Step 2: Note the Application Details

After registration, note down:
- **Application (client) ID** → This is your `ONEDRIVE_CLIENT_ID`
- **Directory (tenant) ID** → This is your `ONEDRIVE_TENANT_ID`

### Step 3: Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description (e.g., "Backup Script Secret")
4. Choose an expiration period (recommend 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately → This is your `ONEDRIVE_CLIENT_SECRET`
   - You cannot view this again after leaving the page!

### Step 4: Configure API Permissions

1. Go to **API permissions** in your app registration
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions** (not Delegated)
5. Add these permissions:
   - `Files.Read.All` - Read all files
   - `Sites.Read.All` - Read all site collections (if using SharePoint)
6. Click **Add permissions**
7. Click **Grant admin consent for [Your Organization]**
   - This requires admin privileges
   - If you're not an admin, request admin consent

### Step 5: (Optional) Configure for Specific User

If you want to backup a specific user's OneDrive:
1. You'll need to use their email address as the `--user-id` parameter
2. Ensure your app has the necessary permissions to access their OneDrive

## Google Cloud Setup (Google Drive)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Name it something like "OneDrive Backup"

### Step 2: Enable Google Drive API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click on it and click **Enable**

### Step 3: Create Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in details:
   - **Service account name**: `onedrive-backup-service`
   - **Description**: "Service account for OneDrive backups"
4. Click **Create and Continue**
5. Skip optional role assignment (click Continue)
6. Click **Done**

### Step 4: Create and Download Service Account Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create**
6. Save the downloaded JSON file securely

### Step 5: Share Google Drive Folder

1. Open Google Drive
2. Create a folder for backups (e.g., "OneDrive Backups")
3. Right-click the folder → **Share**
4. Share it with the service account email (found in the JSON file: `client_email`)
5. Give it **Editor** access
6. Note the folder ID from the URL:
   - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Extract the `FOLDER_ID_HERE` part → This is your `GOOGLE_DRIVE_BACKUP_FOLDER_ID`

## Environment Configuration

### Step 1: Update .env File

In `packages/server/.env`, add the following:

```bash
# OneDrive Configuration
ONEDRIVE_CLIENT_ID=your_azure_ad_client_id_here
ONEDRIVE_CLIENT_SECRET=your_azure_ad_client_secret_here
ONEDRIVE_TENANT_ID=your_azure_ad_tenant_id_here

# Google Drive Configuration
GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
GOOGLE_DRIVE_BACKUP_FOLDER_ID=your_google_drive_folder_id_here
```

### Step 2: Format Credentials JSON

For `GOOGLE_DRIVE_CREDENTIALS_JSON`:
1. Open the downloaded service account JSON file
2. Minify it to a single line (remove all newlines)
3. Wrap it in single quotes
4. Paste into your .env file

**Example format:**
```bash
GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account","project_id":"my-project-123",...}'
```

## Running the Backup

### Basic Usage

```bash
# Navigate to server package
cd packages/server

# Run a dry-run first (recommended)
npm run backup:onedrive:dry-run

# Run actual backup
npm run backup:onedrive
```

### Advanced Options

```bash
# Backup specific folder
bun run src/scripts/onedrive-to-gdrive-backup.ts --folder-id=FOLDER_ID

# Backup specific user's OneDrive (for organizational accounts)
bun run src/scripts/onedrive-to-gdrive-backup.ts --user-id=user@company.com

# Exclude certain files
bun run src/scripts/onedrive-to-gdrive-backup.ts --exclude="*.tmp" --exclude="~$*"

# Combine options
bun run src/scripts/onedrive-to-gdrive-backup.ts \
  --folder-id=ABC123 \
  --exclude="*.tmp" \
  --exclude="desktop.ini" \
  --dry-run
```

### Command Options

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Show what would be backed up without uploading | `--dry-run` |
| `--folder-id=ID` | Backup specific OneDrive folder (default: root) | `--folder-id=ABC123XYZ` |
| `--user-id=EMAIL` | OneDrive user email for organizational accounts | `--user-id=john@company.com` |
| `--exclude=PATTERN` | Exclude files matching pattern (can use multiple times) | `--exclude="*.tmp"` |
| `--help` | Show help message | `--help` |

### Exclude Patterns

Common exclude patterns:
- `*.tmp` - Exclude temporary files
- `~$*` - Exclude Office temp files
- `desktop.ini` - Exclude Windows system files
- `.DS_Store` - Exclude macOS system files
- `Thumbs.db` - Exclude Windows thumbnail cache

## Scheduling Automated Backups

### Option 1: Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add a daily backup at 2 AM
0 2 * * * cd /path/to/airtable_dashboard/packages/server && /usr/local/bin/bun run src/scripts/onedrive-to-gdrive-backup.ts >> /var/log/onedrive-backup.log 2>&1

# Or using npm
0 2 * * * cd /path/to/airtable_dashboard/packages/server && /usr/bin/npm run backup:onedrive >> /var/log/onedrive-backup.log 2>&1
```

### Option 2: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., Daily at 2 AM)
4. Action: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `src/scripts/onedrive-to-gdrive-backup.ts`
   - Start in: `C:\path\to\airtable_dashboard\packages\server`

### Option 3: GitHub Actions (Cloud)

Create `.github/workflows/onedrive-backup.yml`:

```yaml
name: OneDrive to Google Drive Backup

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: |
          cd packages/server
          bun install

      - name: Run backup
        env:
          ONEDRIVE_CLIENT_ID: ${{ secrets.ONEDRIVE_CLIENT_ID }}
          ONEDRIVE_CLIENT_SECRET: ${{ secrets.ONEDRIVE_CLIENT_SECRET }}
          ONEDRIVE_TENANT_ID: ${{ secrets.ONEDRIVE_TENANT_ID }}
          GOOGLE_DRIVE_CREDENTIALS_JSON: ${{ secrets.GOOGLE_DRIVE_CREDENTIALS_JSON }}
          GOOGLE_DRIVE_BACKUP_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_BACKUP_FOLDER_ID }}
        run: |
          cd packages/server
          bun run src/scripts/onedrive-to-gdrive-backup.ts
```

Then add secrets in GitHub: Settings → Secrets and variables → Actions

### Option 4: Docker Container

Create a `Dockerfile.backup`:

```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY packages/server/package.json packages/server/bun.lockb ./
RUN bun install

COPY packages/server/src ./src

CMD ["bun", "run", "src/scripts/onedrive-to-gdrive-backup.ts"]
```

Run with:
```bash
docker build -f Dockerfile.backup -t onedrive-backup .
docker run --env-file packages/server/.env onedrive-backup
```

## Troubleshooting

### Error: "OneDrive credentials are not configured"

**Solution**: Ensure all three OneDrive environment variables are set:
- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `ONEDRIVE_TENANT_ID`

### Error: "GOOGLE_DRIVE_CREDENTIALS_JSON is required"

**Solution**:
1. Verify the JSON is properly formatted (minified to single line)
2. Ensure it's wrapped in single quotes
3. Check for any special characters that might need escaping

### Error: "Insufficient permissions"

**Solution**:
1. For OneDrive: Verify API permissions in Azure AD and ensure admin consent was granted
2. For Google Drive: Verify service account has Editor access to the target folder

### Error: "The caller does not have permission"

**Solution**: The service account email needs to be shared with the Google Drive folder. Check Step 5 of Google Cloud Setup.

### Error: "Failed to download file"

**Solution**:
1. Check if the file is locked or in use
2. Verify OneDrive API permissions include `Files.Read.All`
3. Try running with `--dry-run` to see which files are problematic

### Backup is slow

**Tips for optimization**:
1. Use `--folder-id` to backup specific folders instead of entire OneDrive
2. Use `--exclude` patterns to skip unnecessary files
3. Consider scheduling backups during off-peak hours
4. For very large OneDrive accounts, split backups into multiple runs

### How to verify backup completed successfully

**Check the summary at the end**:
```
📊 Backup Summary
==========================================================
✅ Successfully backed up: 150 files
❌ Failed: 0 files
💾 Total size: 2.45 GB
📁 Target folder: 1AbCdEfGhIjKlMnOpQrS
==========================================================
```

### How to restore files

To restore files from Google Drive:
1. Navigate to your backup folder in Google Drive
2. Files are organized in the same folder structure as OneDrive
3. Download individual files or entire folders as needed
4. Use Google Drive's "Download" feature (right-click → Download)

## Security Best Practices

1. **Rotate credentials regularly**: Set reminders to rotate Azure client secrets and Google service account keys
2. **Limit permissions**: Only grant minimum necessary permissions
3. **Secure .env file**: Never commit `.env` files to version control
4. **Monitor access**: Review Azure AD and Google Cloud audit logs periodically
5. **Use separate service accounts**: Don't reuse service accounts across different applications

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs for detailed error messages
3. Verify all environment variables are correctly set
4. Test connection using `--dry-run` first

## License

This backup script is part of the Airtable Dashboard project.
