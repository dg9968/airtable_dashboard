---
name: tax-notices-workflow
description: IRS Letter / Tax Notice workflow design — roles, statuses, priority rules, and team assignments for Vault 1040
metadata:
  type: project
---

Vault 1040 processes IRS letters and tax notices through a 10-step team workflow. This was designed in June 2026 and the implementation plan was produced. See the implementation plan output for the full Airtable schema, API routes, and page designs.

## Key Business Rules

**Daniel review required when:**
- Notice type = Audit, Collections, Appeals, Levy/Lien
- Tax type = Business, Payroll
- Amount due > threshold (to be determined by Daniel — suggest $5,000 as default)
- Any notice explicitly flagged

**Priority: High** — due ≤14 days, Audit, Collections, Levy/Lien/Garnishment, Business tax, Payroll tax, high-dollar, legal risk

**Priority: Medium** — CP2000, Penalty, Missing form, State notice with deadline

**Priority: Low** — Informational, Processing delay, Balance already known, Duplicate

## Status Flow (ordered)
1. New Notice
2. Scanned / Uploaded
3. Initial Review
4. Waiting on Client
5. Research / Drafting
6. Needs Daniel Review
7. Ready to Submit
8. Submitted
9. Waiting on Agency
10. Resolved
11. Closed / Archived

## Role → Default Owner Assignment
- Audit → Daniel
- Collections → Daniel
- Levy/Lien → Daniel
- Appeals → Daniel
- Business notice → Daniel
- Payroll notice → Daniel
- CP2000 / individual income mismatch → Genesis
- Penalty notice → Genesis
- Informational → Genesis
- State notice → Genesis (escalate to Daniel if complex)

## Why:
This is the operational workflow designed for the Tax Notices feature. The priority rules and Daniel-escalation logic should drive any auto-triage engine.

## How to apply:
Use these rules to implement the auto-triage function in the server route. Any UI decision about what to show Daniel vs. Genesis should reference these rules.
