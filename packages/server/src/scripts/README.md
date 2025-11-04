# Backup Scripts

This directory contains utility scripts for backing up data between different cloud storage services.

## OneDrive to Google Drive Backup

Automatically backs up files from Microsoft OneDrive to Google Drive while preserving folder structure.

### Quick Start

```bash
# From packages/server directory

# 1. First, run a dry-run to see what would be backed up
npm run backup:onedrive:dry-run

# 2. Run the actual backup
npm run backup:onedrive
```

### Configuration

Before running, configure these environment variables in `packages/server/.env`:

```bash
# OneDrive
ONEDRIVE_CLIENT_ID=your_azure_client_id
ONEDRIVE_CLIENT_SECRET=your_azure_client_secret
ONEDRIVE_TENANT_ID=your_azure_tenant_id

# Google Drive
GOOGLE_DRIVE_CREDENTIALS_JSON='{"type":"service_account",...}'
GOOGLE_DRIVE_BACKUP_FOLDER_ID=your_target_folder_id
```

### Advanced Usage

```bash
# Backup specific folder
bun run src/scripts/onedrive-to-gdrive-backup.ts --folder-id=FOLDER_ID

# Backup specific user (for organizational OneDrive)
bun run src/scripts/onedrive-to-gdrive-backup.ts --user-id=user@company.com

# Exclude certain files
bun run src/scripts/onedrive-to-gdrive-backup.ts --exclude="*.tmp" --exclude="~$*"

# Show help
bun run src/scripts/onedrive-to-gdrive-backup.ts --help
```

### Full Setup Guide

For detailed setup instructions including Azure AD and Google Cloud configuration, see:
📖 **[ONEDRIVE_BACKUP_SETUP.md](/docs/ONEDRIVE_BACKUP_SETUP.md)**

### Features

- ✅ Preserves folder structure
- ✅ Incremental backups (updates existing files)
- ✅ Dry-run mode for testing
- ✅ File exclusion patterns
- ✅ Progress tracking
- ✅ Detailed error reporting
- ✅ Works with personal and organizational accounts

### Common Use Cases

**Daily automated backup:**
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/server && npm run backup:onedrive
```

**Backup specific project folder:**
```bash
bun run src/scripts/onedrive-to-gdrive-backup.ts \
  --folder-id=ABC123 \
  --exclude="node_modules" \
  --exclude=".git"
```

**Test before running:**
```bash
npm run backup:onedrive:dry-run
```

### Troubleshooting

**Permission errors:**
- Verify Azure AD app has `Files.Read.All` permission
- Ensure Google Drive folder is shared with service account

**Connection errors:**
- Check environment variables are set correctly
- Verify credentials have not expired

**Slow performance:**
- Use `--folder-id` to backup specific folders
- Use `--exclude` to skip unnecessary files
- Schedule during off-peak hours

For more troubleshooting help, see the [full documentation](/docs/ONEDRIVE_BACKUP_SETUP.md#troubleshooting).
