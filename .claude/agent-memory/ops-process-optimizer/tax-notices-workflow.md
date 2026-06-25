---
name: tax-notices-workflow
description: IRS Letter / Tax Notice workflow design — roles, statuses, priority rules, team assignments, and response lifecycle gaps for Vault 1040
metadata:
  type: project
---

Vault 1040 processes IRS letters and tax notices through an 11-status team workflow. Implementation shipped in June 2026. The response document lifecycle (draft → sign → send) is NOT yet implemented and is the primary pending work.

## Current Implementation State (as of June 2026)

**Airtable fields in Tax Notices table:**
- Client Name, Entity Name, Notice Agency, Notice Number, Notice Category, Tax Type, Tax Year, Date Received, Response Due Date, Amount Due
- Status (single select, 11 values), Priority, Assigned Owner, Supporting Team Member, Daniel Review Required
- Client Documents Needed, Response Filed Date, Proof of Submission Uploaded (checkbox), Final Resolution
- Letter Drive ID, Letter View URL, Letter File Name (single file — Drive upload)
- Created By, Created Time
- Tax Notice Notes is a linked table via [noticeId] linked record field

**What is implemented:**
- Full list/filter/search page at /tax-notices
- Detail page at /tax-notices/[id] with status advancement, file controls, workflow fields
- New notice form at /tax-notices/new with auto-triage
- Deadline monitor and review queue sub-pages
- Single-file notice letter upload → Google Drive (Tax Notices/{noticeId}/ folder)
- Notes conversation via Tax Notice Notes linked table
- Status transition guard logic on advance-status endpoint

**What is NOT yet implemented (pending work):**
1. Multi-file support for initial notice letter (currently: one Drive ID field — replace with array or separate Airtable attachments table)
2. Response document lifecycle: draft upload → client signature step → signed copy upload → agency submission tracking
3. Owner/team notifications: no email or in-app notification system exists for notice events

## Key Business Rules

**Daniel review required when:**
- Notice category = Audit, Collections, Appeal, Levy/Lien, Garnishment
- Tax type = Business, Payroll
- Amount due >= $2,000 (HIGH_DOLLAR_THRESHOLD in server code)
- Any notice explicitly flagged

**Priority: High** — due ≤14 days, Audit, Collections, Levy/Lien/Garnishment, Business tax, Payroll tax, high-dollar
**Priority: Medium** — CP2000, Penalty, Missing Form
**Priority: Low** — all others

**Auto-triage assignment:**
- danielReviewRequired = true → assignedOwner = 'Daniel'
- else → assignedOwner = 'Genesis'

## Status Flow (11 states, ordered)
1. New Notice
2. Scanned / Uploaded
3. Initial Review
4. Waiting on Client
5. Research / Drafting
6. Needs Daniel Review (only reachable if danielReviewRequired = true)
7. Ready to Submit
8. Submitted (guarded: responseFiledDate + proofOfSubmissionUploaded required)
9. Waiting on Agency
10. Resolved
11. Closed / Archived (guarded: finalResolution required)

## Google Drive folder structure for notices
Tax Notices/{noticeId}/ — all notice letter files stored here via uploadTaxNoticeLetter()

## Why:
This is the core operational workflow. The response lifecycle gap is the next priority. Notifications are a parallel need triggered by key status transitions.

## How to apply:
Use these rules to implement the auto-triage function in the server route. Any UI decision about what to show Daniel vs. Genesis should reference these rules. When designing the response lifecycle, insert new statuses between Research/Drafting and Ready to Submit (or augment existing statuses with sub-state fields). See [[tax-notices-response-lifecycle]] when created.
