# OneDrive to Google Drive Migration Guide

This document explains how to migrate your document management system from OneDrive to Google Drive while maintaining Airtable database integrity.

## Overview

The migration script automatically transfers all documents from OneDrive to Google Drive, creating the proper folder structure and updating Airtable records with new Google Drive file IDs and links.

## Prerequisites

Before running the migration:

1. **Download OneDrive files** to a local directory
2. **Verify environment variables** are configured:
   - `GOOGLE_DRIVE_CREDENTIALS_JSON` - Google Drive API credentials
   - `GOOGLE_DRIVE_FOLDER_ID` - Root folder ID in Google Drive
   - `AIRTABLE_BASE_ID` - Your Airtable base ID
   - `AIRTABLE_PERSONAL_ACCESS_TOKEN` - Airtable API token
3. **Ensure sufficient Google Drive storage** space
4. **Backup Airtable base** (optional but recommended)

## Folder Structure

### Old Structure (OneDrive)
The script supports multiple OneDrive folder structures:

**Personal Documents (Old Style):**
```
Tax Year 2024/
  └── Client 1578/
      ├── document1.pdf
      ├── document2.pdf
      └── w2-form.pdf
```

**Corporate Documents:**
```
Corporate/
  └── Client 2747/
      ├── Financial Statements/
      │   ├── Chase Checking/
      │   │   └── Tax Year 2024/
      │   │       ├── january-statement.pdf
      │   │       └── february-statement.pdf
      │   └── Wells Fargo/
      │       └── Tax Year 2024/
      │           └── statement.pdf
      ├── Tax Returns/
      │   └── 2024-return.pdf
      └── Business Credentials/
          └── ein-letter.pdf
```

### New Structure (Google Drive)

**Personal Documents:**
```
Personal/
  └── Client 1578/
      └── Tax Year 2024/
          ├── document1.pdf
          ├── document2.pdf
          └── w2-form.pdf
```

**Corporate Documents:**
```
Corporate/
  └── Client 2747/
      ├── Financial Statements/
      │   ├── Chase Checking/
      │   │   └── Tax Year 2024/
      │   │       ├── january-statement.pdf
      │   │       └── february-statement.pdf
      │   └── Wells Fargo/
      │       └── Tax Year 2024/
      │           └── statement.pdf
      ├── Tax Returns/
      │   └── Tax Year 2024/
      │       └── 2024-return.pdf
      └── Business Credentials/
          └── ein-letter.pdf
```

## Migration Process

### Step 1: Download OneDrive Files

Download all files from OneDrive to a local directory, maintaining the folder structure. For example:
```
C:\Migration\OneDrive\
```

### Step 2: Test Migration (Dry Run)

Run the migration script in dry-run mode to verify everything will work correctly:

```bash
cd packages/server
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive \
  --dry-run
```

**What dry-run does:**
- ✅ Scans all files
- ✅ Parses metadata from folder structure
- ✅ Shows what would be migrated
- ✅ Validates client codes and file structure
- ❌ Does NOT upload files
- ❌ Does NOT modify Airtable

**Expected output:**
```
🚀 Starting OneDrive to Google Drive Migration

📂 Source Directory: C:\Migration\OneDrive
🌐 Google Drive Root: 0ALuqcJrESspqUk9PVA
🔍 DRY RUN MODE - No files will be uploaded

📊 Scanning source directory...
Found 237 files

[1/237] Processing: Tax Year 2024/Client 1578/w2-form.pdf
  📋 Client: 1578 | Year: 2024 | Personal
  🔍 Would upload to Google Drive and update Airtable

[2/237] Processing: Corporate/Client 2747/Financial Statements/Chase Checking/Tax Year 2024/january.pdf
  📋 Client: 2747 | Year: 2024 | Corporate
  🔍 Would upload to Google Drive and update Airtable

...

📊 MIGRATION SUMMARY
============================================================
Total Files:       237
✅ Successful:     237
⏭️  Skipped:        0
❌ Failed:         0
============================================================

🔍 This was a DRY RUN. Remove --dry-run flag to perform actual migration.
```

### Step 3: Run Full Migration

Once the dry run looks good, run the actual migration:

```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive
```

**What happens:**
1. Scans all files
2. For each file:
   - Extracts client code, tax year, and category from path
   - Creates necessary folders in Google Drive (if they don't exist)
   - Uploads file to correct location
   - Makes file shareable with link
   - Creates or updates Airtable record with:
     - Google Drive File ID
     - Web View Link
     - Web Content Link
     - File metadata (size, type, date)
3. Reports progress and final summary

**Sample output:**
```
🚀 Starting OneDrive to Google Drive Migration

📂 Source Directory: C:\Migration\OneDrive
🌐 Google Drive Root: 0ALuqcJrESspqUk9PVA
✅ LIVE MODE - Files will be uploaded

[1/237] Processing: Tax Year 2024/Client 1578/w2-form.pdf
  📋 Client: 1578 | Year: 2024 | Personal
  ⬆️  Uploading to Google Drive...
  ✅ Uploaded: 1XyZaBc123...
  📝 Updating Airtable...
  ✅ Created Airtable record: recABC123

[2/237] Processing: Corporate/Client 2747/Financial Statements/Chase Checking/Tax Year 2024/january.pdf
  📋 Client: 2747 | Year: 2024 | Corporate
  ⬆️  Uploading to Google Drive...
  ✅ Uploaded: 1DeF456...
  📝 Updating Airtable...
  ✅ Updated Airtable record: recDEF456

...

📊 MIGRATION SUMMARY
============================================================
Total Files:       237
✅ Successful:     235
⏭️  Skipped:        0
❌ Failed:         2
============================================================

❌ ERRORS:

1. Tax Year 2024/Client 9999/broken.pdf
   Error: Could not parse client code from path

2. Corporate/Client 1234/large-file.pdf
   Error: File size exceeds Google Drive quota

✅ Migration complete!
```

### Step 4: Resume Failed Files (If Needed)

If some files failed, you can:

1. **Fix the issues** (rename files, add storage, etc.)
2. **Re-run with skip-existing** to only process failed files:

```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive \
  --skip-existing
```

This will skip files that already have a Google Drive File ID in Airtable.

## Command-Line Options

### `--source-dir` (Required)
Path to the local directory containing downloaded OneDrive files.

**Example:**
```bash
--source-dir=/path/to/onedrive
--source-dir=C:\Migration\OneDrive
```

### `--dry-run` (Optional)
Simulate the migration without uploading files or modifying Airtable.

**Use this to:**
- Test the migration before running it
- Verify file paths are parsed correctly
- Check for potential errors

**Example:**
```bash
--dry-run
```

### `--skip-existing` (Optional)
Skip files that already have a Google Drive File ID in Airtable.

**Use this to:**
- Resume a partially completed migration
- Retry only failed files
- Avoid re-uploading already migrated files

**Example:**
```bash
--skip-existing
```

## File Path Parsing

The script automatically detects file organization patterns and extracts metadata:

### Pattern 1: Old Personal Structure
```
Tax Year 2024/Client 1578/document.pdf
```
- **Client Code:** 1578
- **Tax Year:** 2024
- **Type:** Personal

### Pattern 2: New Personal Structure
```
Personal/Client 1578/Tax Year 2024/document.pdf
```
- **Client Code:** 1578
- **Tax Year:** 2024
- **Type:** Personal

### Pattern 3: Corporate with Financial Statements
```
Corporate/Client 2747/Financial Statements/Chase Checking/Tax Year 2024/statement.pdf
```
- **Client Code:** 2747
- **Tax Year:** 2024
- **Type:** Corporate
- **Category:** statements
- **Bank Name:** Chase Checking

### Pattern 4: Corporate with Other Categories
```
Corporate/Client 2747/Tax Returns/Tax Year 2024/return.pdf
```
- **Client Code:** 2747
- **Tax Year:** 2024
- **Type:** Corporate
- **Category:** tax-returns

### Pattern 5: Year-Independent Categories
```
Corporate/Client 2747/Business Credentials/ein-letter.pdf
```
- **Client Code:** 2747
- **Tax Year:** N/A
- **Type:** Corporate
- **Category:** business-credentials

## Supported Document Categories

### Personal Documents
- All documents organized by Tax Year

### Corporate Documents
- **Financial Statements** - Bank statements organized by bank name and year
- **Tax Returns** - Tax return documents
- **Notices and Letters** - IRS notices and correspondence
- **Sales Tax** - Sales tax documents
- **Payroll Tax** - Payroll tax documents
- **Business Credentials** - EIN letters, business licenses (year-independent)
- **Bookkeeping** - Bookkeeping records
- **Bills and Invoices** - Business bills and invoices

## Airtable Updates

For each migrated file, the script updates the `Documents` table with:

| Field | Description | Example |
|-------|-------------|---------|
| Client Code | 4-digit client identifier | 1578 |
| Tax Year | Tax filing year or "N/A" | 2024 |
| File Name | Name of the file | document.pdf |
| Original Name | Original file name | document.pdf |
| Upload Date | Date of migration | 2026-01-07 |
| File Size | Size in bytes | 1048576 |
| File Type | MIME type | application/pdf |
| Google Drive File ID | Unique Google Drive ID | 1XyZaBc123... |
| Web View Link | Link to view in browser | https://drive.google.com/... |
| Web Content Link | Direct download link | https://drive.google.com/... |
| Document Category | Category (corporate only) | statements |
| Bank Name | Bank name (statements only) | Chase Checking |

## Troubleshooting

### Issue: "Could not parse client code from path"

**Cause:** File is not in a recognized folder structure.

**Solution:** Ensure files follow one of the supported patterns with a 4-digit client code:
- `Tax Year XXXX/Client 1234/file.pdf`
- `Personal/Client 1234/Tax Year XXXX/file.pdf`
- `Corporate/Client 1234/Category/file.pdf`

### Issue: "File size exceeds Google Drive quota"

**Cause:** Not enough storage in Google Drive.

**Solutions:**
1. Increase Google Drive storage
2. Exclude large files and migrate them separately
3. Compress files before migration

### Issue: "Rate limit exceeded"

**Cause:** Google Drive API rate limits.

**Solution:** The script will automatically retry. If it continues, wait a few minutes and run with `--skip-existing`.

### Issue: "Airtable save failed"

**Cause:** Airtable API error or invalid field values.

**Solutions:**
1. Check that all required fields exist in your Documents table
2. Verify field names match exactly (case-sensitive)
3. Check Airtable API rate limits
4. Note: File still uploads to Google Drive; you can manually update Airtable

### Issue: Files uploaded but not showing in dashboard

**Cause:** Airtable records may not have been created/updated correctly.

**Solution:**
1. Check Airtable Documents table manually
2. Re-run migration with `--skip-existing` to update records
3. Verify Document Category and Bank Name fields are correct

## Post-Migration Verification

After migration completes:

1. **Check Airtable:**
   - Open Documents table
   - Verify Google Drive File ID field is populated
   - Verify Web View Link and Web Content Link are present
   - Check that all expected records exist

2. **Test Document Browser:**
   - Go to Document Management or Corporate Document Management
   - Search for a migrated client
   - Select Tax Year and Category
   - Click "Fetch Documents"
   - Verify documents appear and are downloadable

3. **Test Document Upload:**
   - Upload a new test document
   - Verify it appears in Google Drive in correct location
   - Verify Airtable record is created
   - Verify document appears in browser

4. **Spot Check Files:**
   - Open a few Google Drive links from Airtable
   - Verify files open and display correctly
   - Check that folder structure matches expectations

## Migration Checklist

- [ ] Backup Airtable base
- [ ] Download all OneDrive files to local directory
- [ ] Verify environment variables are set
- [ ] Run dry-run migration and review output
- [ ] Check for parsing errors or skipped files
- [ ] Fix any folder structure issues identified
- [ ] Run full migration
- [ ] Review migration summary for errors
- [ ] Fix and re-run failed files with `--skip-existing`
- [ ] Verify random sample of files in Google Drive
- [ ] Test Document Browser with migrated files
- [ ] Verify Airtable records have Google Drive IDs
- [ ] Test document download functionality
- [ ] Delete local OneDrive files (after verification)
- [ ] Delete original OneDrive files (after verification)

## Best Practices

1. **Test First:** Always run with `--dry-run` before actual migration
2. **Start Small:** Test with a small subset of files first
3. **Backup:** Backup Airtable before migration
4. **Monitor:** Watch the console output during migration
5. **Verify:** Spot-check files after migration
6. **Keep Logs:** Save console output for reference
7. **Incremental:** Migrate in batches if you have thousands of files

## Support

If you encounter issues:

1. Check the error messages in console output
2. Review the Troubleshooting section above
3. Verify your environment variables are correct
4. Check Google Drive and Airtable API quotas
5. Review the migration script logs for details

## Technical Details

### Script Location
```
packages/server/src/scripts/migrate-onedrive-to-gdrive.ts
```

### Dependencies
- `googleapis` - Google Drive API client
- `airtable` - Airtable API client
- `fs` - File system operations
- `path` - Path manipulation

### API Rate Limits
- **Google Drive:** 1000 requests per 100 seconds per user
- **Airtable:** 5 requests per second

The script handles these limits automatically with retries.

### File Size Limits
- **Google Drive:** 5TB per file (with Google Workspace)
- **Airtable:** N/A (only stores metadata, not files)

## Example Commands

### Test migration
```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive \
  --dry-run
```

### Full migration
```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive
```

### Resume failed files
```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive \
  --skip-existing
```

### Test with specific folder
```bash
bun run src/scripts/migrate-onedrive-to-gdrive.ts \
  --source-dir=C:\Migration\OneDrive\Corporate\Client_2747 \
  --dry-run
```

## FAQ

**Q: Can I run the migration multiple times?**
A: Yes! Use `--skip-existing` to avoid re-uploading files. The script will update Airtable records even for existing files.

**Q: What happens if the migration is interrupted?**
A: You can resume by running the script again with `--skip-existing`. Already migrated files will be skipped.

**Q: Will this delete my OneDrive files?**
A: No! The script only reads from OneDrive. You must manually delete OneDrive files after verifying the migration.

**Q: Can I migrate only specific clients?**
A: Yes! Point `--source-dir` to a specific client folder instead of the entire OneDrive directory.

**Q: How long does migration take?**
A: Depends on file count and size. Roughly 1-2 seconds per file including API calls. 1000 files ≈ 30-60 minutes.

**Q: Will links in Airtable break?**
A: Old OneDrive links will no longer work. The migration creates new Google Drive links in Airtable.

**Q: Can I migrate incrementally?**
A: Yes! Migrate by client, year, or category by organizing source directory accordingly.

**Q: What if a file already exists in Google Drive?**
A: The script will create a new file. Google Drive allows duplicate names in the same folder.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Script Version:** migrate-onedrive-to-gdrive.ts v1.0
