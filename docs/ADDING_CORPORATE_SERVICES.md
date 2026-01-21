# Adding a New Corporate Service - Reference Guide

## Overview
This document provides a comprehensive checklist for adding a new service (e.g., "Corporate Cases") to the corporate services system in the Airtable Dashboard application.

## Prerequisites
- Service must exist in Airtable's "Services Corporate" table
- You need the exact service name as it appears in Airtable

---

## Changes Required

### 1. **Airtable Setup** (Manual - Not in Code)

**Table: Services Corporate**
- Add a new record with the service name (e.g., "Corporate Cases")
- Note the exact spelling - this will be used throughout the code

**Table: Subscriptions Corporate**
- Create a view matching the service name exactly (e.g., "Corporate Cases")
- This view should filter for records where the Services field contains this service

---

### 2. **Code Changes**

#### **File 1: `packages/client/components/CorporateClientIntake.tsx`**

**Location:** Lines 85-91
**What to change:** Add the new service to the hardcoded services array

```typescript
// Available services
const services = [
  "Reconciling Banks for Tax Prep",
  "Payroll",
  "Bookkeeping",
  "Annual Report",
  "1099 Filing",
  "Corporate Cases"  // ADD NEW SERVICE HERE
];
```

**Purpose:** This populates the dropdown in the Corporate Client Intake form where staff can select which service to add a company to.

---

#### **File 2: `packages/client/components/CorporateServicesPipeline.tsx`**

**Location:** Lines 47-56
**What to change:** Add the new service with both display name and view name

```typescript
// Available services - these match the view names in Airtable
const services = [
  { name: "Reconciling Banks for Tax Prep", view: "Reconciling Banks for Tax Prep" },
  { name: "Tax Returns", view: "Tax Returns" },
  { name: "Payroll", view: "Payroll" },
  { name: "Annual Report", view: "Annual Report" },
  { name: "Sales Tax Monthly", view: "Monthly Sales Tax" },
  { name: "Sales Tax Quarterly", view: "Quarterly Sales Tax" },
  { name: "Registered Agent", view: "Registered Agent" },
  { name: "1099 Filing", view: "1099 Filing" },
  { name: "Corporate Cases", view: "Corporate Cases" }  // ADD NEW SERVICE HERE
];
```

**Purpose:**
- `name`: Display name shown in the service filter dropdown
- `view`: Exact Airtable view name used to filter subscriptions
- This allows filtering the pipeline by specific service

---

### 3. **Backend/API Changes**

#### **No Changes Required in:**

- `packages/server/src/routes/services.ts` - Dynamically fetches all services from Airtable
- `packages/server/src/routes/subscriptions-corporate.ts` - Generic junction table handler
- `packages/client/app/api/services/route.ts` - Proxy to backend
- `packages/client/app/api/subscriptions-corporate/route.ts` - Proxy to backend

**Why:** These files are designed to work dynamically with any service from the Services Corporate table.

---

### 4. **Optional: Dashboard/Stats Updates**

If you want the service to appear in dashboard statistics or billing views:

#### **File: `packages/client/components/Dashboard.tsx`** (if applicable)
- Review any hardcoded service lists or filters
- Add to any service-specific counters or displays

#### **File: `packages/client/components/ProcessorBilling.tsx`** (if applicable)
- Check if there are service-specific views or filters that need updating

---

## Verification Checklist

After making changes, verify the following:

### **1. Client Intake**
- [ ] Open Corporate Client Intake page
- [ ] Create or select a company
- [ ] Verify "Corporate Cases" appears in the service dropdown
- [ ] Select "Corporate Cases" and click "Add to Service"
- [ ] Verify subscription is created in Airtable

### **2. Pipeline View**
- [ ] Open Corporate Services Pipeline page
- [ ] Verify "Corporate Cases" appears in the service filter dropdown
- [ ] Select "Corporate Cases" from filter
- [ ] Verify companies subscribed to this service appear
- [ ] Verify you can assign processors, update status, complete service

### **3. Airtable Verification**
- [ ] Check Subscriptions Corporate table
- [ ] Verify new records have correct links to:
  - Customer (Corporations table)
  - Services (Services Corporate table with "Corporate Cases")
- [ ] Verify the "Corporate Cases" view shows only relevant subscriptions

### **4. API Testing**
```bash
# Test services endpoint returns new service
curl http://localhost:3001/api/services

# Test creating subscription with new service
# (Get serviceId from above response)
curl -X POST http://localhost:3001/api/subscriptions-corporate \
  -H "Content-Type: application/json" \
  -d '{"corporateId": "recXXX", "serviceId": "recYYY"}'

# Test filtering by view
curl "http://localhost:3001/api/subscriptions-corporate?view=Corporate%20Cases"
```

---

## Common Issues & Troubleshooting

### **Issue: Service doesn't appear in dropdown**
- **Check:** Is the service name spelled exactly the same in both files?
- **Check:** Did you restart the development server after changes?

### **Issue: "Service not found" error when adding to pipeline**
- **Check:** Does the service exist in Airtable's Services Corporate table?
- **Check:** Is the service name spelled exactly as it appears in Airtable?

### **Issue: Companies don't appear when filtering by service**
- **Check:** Does the Airtable view exist with the exact name?
- **Check:** Is the view filtering correctly on the Services field?
- **Check:** Are there actually subscriptions for this service?

### **Issue: View mismatch**
- **Check:** In CorporateServicesPipeline.tsx, does the `view` property match the Airtable view name exactly?
- **Note:** The `name` can be different (display name), but `view` must match Airtable

---

## Architecture Notes

### **How Services Work**

1. **Services Corporate Table (Airtable)**
   - Stores all available services
   - Each service is a record with a name field

2. **Subscriptions Corporate Table (Airtable)**
   - Junction table linking Corporations to Services
   - Fields: Customer (link to Corporations), Services (link to Services Corporate)
   - Has views named after each service for filtering

3. **Frontend Service Selection**
   - CorporateClientIntake: Shows dropdown to add company to service
   - CorporateServicesPipeline: Shows dropdown to filter view by service
   - Both use hardcoded arrays that must match Airtable data

4. **API Flow**
   ```
   User selects "Corporate Cases"
   ↓
   Frontend looks up service ID from Services Corporate table
   ↓
   Frontend POSTs to /api/subscriptions-corporate with corporateId + serviceId
   ↓
   Backend creates junction record in Subscriptions Corporate
   ↓
   Company now appears in "Corporate Cases" pipeline view
   ```

---

## Summary: Quick Add Checklist

To add a new corporate service:

1. ✅ **Airtable:** Add service to Services Corporate table
2. ✅ **Airtable:** Create view in Subscriptions Corporate table
3. ✅ **Code:** Add to `CorporateClientIntake.tsx` services array (line ~86)
4. ✅ **Code:** Add to `CorporateServicesPipeline.tsx` services array (line ~47)
5. ✅ **Test:** Verify in both Client Intake and Pipeline views
6. ✅ **Verify:** Check Airtable subscriptions are created correctly

---

## Files Modified When Adding a Service

- `packages/client/components/CorporateClientIntake.tsx`
- `packages/client/components/CorporateServicesPipeline.tsx`

## Files to Review (Potentially)

- `packages/client/components/Dashboard.tsx`
- `packages/client/components/ProcessorBilling.tsx`
