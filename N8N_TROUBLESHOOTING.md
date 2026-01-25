# n8n Workflow Troubleshooting Guide

## Problem: Status Not Updating After Email Sent

### Root Cause
The original workflow uses a **Loop Over Records** node which creates a sequential bottleneck. The status update happens after each email is sent, but timing issues can occur.

### Solution Options

## Option 1: Remove the Loop (Recommended)

**Why:** Processes all emails in parallel, faster and more reliable.

**Workflow:** [simple-parallel-batch-workflow.json](n8n-workflows/simple-parallel-batch-workflow.json)

**Steps:**
1. Webhook receives batch
2. Split out clients (creates multiple execution paths)
3. Send email (Gmail) - runs in parallel for all clients
4. Check if successful
5. Update status (Sent or Failed)

**Benefits:**
- ✅ Faster (parallel processing)
- ✅ Simpler (no loop logic)
- ✅ More reliable (no timing issues)
- ✅ Each client processed independently

## Option 2: Improved Loop with Error Handling

**Why:** If you need sequential processing for rate limiting.

**Workflow:** [improved-batch-email-workflow.json](n8n-workflows/improved-batch-email-workflow.json)

**Steps:**
1. Webhook receives batch
2. Split out clients
3. Prepare data (validation)
4. Check if email and record ID exist
5. Send email OR skip
6. Update status
7. Aggregate results

**Benefits:**
- ✅ Rate limit friendly
- ✅ Better error handling
- ✅ Detailed logging
- ✅ Aggregated results

---

## Debugging the Current Issue

### 1. Check if Junction Record ID is Being Passed

In n8n, add a **Code** node after "Split Out Clients":

```javascript
const item = $input.first();

console.log('Junction Record ID:', item.json.junctionRecordId);
console.log('Client Email:', item.json.clientData?.email);
console.log('Full payload:', JSON.stringify(item.json, null, 2));

return [item];
```

### 2. Verify Airtable Update is Working

The update operation needs:
- **Correct table ID** - `tbljseIDN7BhR2TyE` (Communications Corporate)
- **Correct base ID** - `app3Gj45Ql7EwjLIg`
- **Valid record ID** - From `junctionRecordId` field
- **Field name matches** - "Status" field exists in Airtable

### 3. Check Timing Issues

Add a **Wait** node (1-2 seconds) between "Send Email" and "Update Status":

```
Send Email → Wait (2 seconds) → Update Status
```

This ensures Airtable has time to fully create the record.

---

## Recommended Fix: Update Your Current Workflow

### Quick Fix to Your Existing Workflow

Replace your "Update Message Status" node configuration:

**Current (might fail):**
```json
{
  "id": "={{ $json.junctionRecordId }}",
  "Status": "Sent"
}
```

**Fixed (with fallback):**
```json
{
  "id": "={{ $('Loop Over Records').item.json.junctionRecordId }}",
  "Status": "Sent"
}
```

Or use a **Code** node before update:

```javascript
// Ensure we have the junction record ID from the original input
const item = $input.first();
const loopItem = $('Loop Over Records').item.json;

return [{
  json: {
    junctionRecordId: loopItem.junctionRecordId || item.json.junctionRecordId,
    status: 'Sent',
    clientName: loopItem.clientData?.name || 'Unknown',
    timestamp: new Date().toISOString()
  }
}];
```

---

## Testing the Workflow

### 1. Test with Single Client First

Send a batch with just 1 client:

```bash
curl -X POST https://your-n8n.com/webhook/batch-email \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "batch",
    "batchId": "test_123",
    "totalClients": 1,
    "clients": [{
      "junctionRecordId": "recXXXXXXXXXXXXXX",
      "corporateId": "recYYYYYYYYYYYYYY",
      "clientData": {
        "email": "test@example.com",
        "name": "Test Company"
      },
      "emailSubject": "Test Subject",
      "emailContent": "Test Content"
    }]
  }'
```

### 2. Check n8n Execution Log

In n8n:
1. Go to **Executions**
2. Find your workflow execution
3. Click on each node to see output
4. Verify:
   - ✅ "Split Out Clients" outputs 1 item with `junctionRecordId`
   - ✅ "Send Email" shows success
   - ✅ "Update Message Status" receives the correct ID

### 3. Verify in Airtable

Check the "Communications Corporate" table:
- Find the record by `junctionRecordId`
- Status field should change from "Pending" → "Sent"
- If it doesn't change, the ID is wrong or the update failed

---

## Common Issues & Solutions

### Issue 1: "Record not found"

**Cause:** Junction record ID is incorrect or doesn't exist yet

**Solution:**
- Verify the batch API is creating the junction records before triggering the webhook
- Check the API response includes `junctionIds` array
- Ensure webhook is triggered AFTER Airtable records are created

### Issue 2: Status field not updating

**Cause:** Field name mismatch or permissions

**Solution:**
- Verify field is called exactly "Status" (case-sensitive)
- Check Airtable API token has write permissions
- Ensure field type is "Single Select" with "Sent" as an option

### Issue 3: Loop not processing all clients

**Cause:** Loop configuration or error in one client breaking the loop

**Solution:**
- Enable "Continue on Fail" on Gmail node
- Remove the loop and use parallel processing instead

### Issue 4: Webhook times out

**Cause:** Processing too many clients sequentially

**Solution:**
- Use parallel processing (no loop)
- Or return response immediately and process async

---

## Optimal Workflow Architecture

```
┌──────────┐
│ Webhook  │
└────┬─────┘
     │
     v
┌──────────────┐
│ Split Clients│ (Creates N parallel paths)
└────┬─────────┘
     │
     v (Parallel for each client)
┌──────────────┐
│  Send Email  │ ← Enable "Continue on Fail"
└────┬─────────┘
     │
     v
┌──────────────┐
│ Check Result │ (IF node)
└─────┬────────┘
      │
   ┌──┴──┐
   v     v
┌─────┐ ┌──────┐
│Sent │ │Failed│
└─┬───┘ └───┬──┘
  │         │
  v         v
┌─────────────┐
│Update Status│
└─────────────┘
```

---

## Verification Checklist

- [ ] Junction record IDs are being passed in webhook payload
- [ ] n8n can read `junctionRecordId` from the split items
- [ ] Airtable update node uses correct base and table IDs
- [ ] Status field exists and has "Sent" option
- [ ] API token has write permissions
- [ ] Webhook is triggered AFTER records are created
- [ ] "Continue on Fail" is enabled on Gmail node

---

## Quick Test Command

Test your webhook directly:

```javascript
// In n8n, add this as a Code node after webhook:
const payload = $input.first().json.body;

console.log('Batch ID:', payload.batchId);
console.log('Total Clients:', payload.totalClients);
console.log('First Client Junction ID:', payload.clients[0]?.junctionRecordId);

// Verify all clients have junction IDs
const missingIds = payload.clients.filter(c => !c.junctionRecordId);
if (missingIds.length > 0) {
  throw new Error(`${missingIds.length} clients missing junction IDs!`);
}

return [$input.first()];
```

---

## Need Help?

1. Check n8n execution logs for errors
2. Verify Airtable records exist with correct IDs
3. Test with 1 client first
4. Enable detailed logging in n8n
5. Check API token permissions in Airtable

**The simple parallel workflow (Option 1) is recommended for most use cases.**
