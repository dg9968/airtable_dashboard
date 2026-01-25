# n8n Batch Workflow Setup Guide

## Your Current Batch Payload Structure

When you send a batch communication, n8n receives this payload:

```json
{
  "mode": "batch",
  "batchId": "batch_20240124_...",
  "timestamp": "2024-01-24T...",
  "totalClients": 1,
  "clients": [
    {
      "messageId": "recrUMgGhhA402p8R",
      "corporateId": "recOvWy22R57Z5btA",
      "junctionRecordId": "recQN4kpV3CwwB9No",  // ← This is what you need
      "clientData": {
        "name": "DAME CONSULTING LLC",
        "email": "daniel.galindo@me.com",
        "ein": "46-5443009",
        "phone": "(786) 402-0386",
        "address": "10913 SW 232nd Ter",
        "city": "MIAMI",
        "state": "FLORIDA",
        "zipCode": "33032",
        "clientCode": "3009"
      },
      "emailSubject": "DAME CONSULTING LLC - Monthly Billing Update",
      "emailContent": "Dear DAME CONSULTING LLC,\n\nWe are updating your monthly billing from $343 to $343434...",
      "variableValues": {
        "currentAmount": "343",
        "newAmount": "343434"
      }
    }
  ]
}
```

## Quick Fix: Import the Correct Workflow

**Option 1: Simple Parallel Workflow (Recommended)**

1. In n8n, go to **Workflows**
2. Click **Import from File**
3. Select: `n8n-workflows/simple-parallel-batch-workflow.json`
4. Update your Gmail credentials in the "Send Email" node
5. Update your Airtable credentials in the update nodes
6. **Activate the workflow**

This workflow will:
- ✅ Receive batch payload
- ✅ Split clients array into parallel executions
- ✅ Send email for each client
- ✅ Update status to "Sent" or "Failed" using `junctionRecordId`

## Manual Configuration Steps

If you want to update your existing workflow:

### Step 1: Webhook Node
- **Path**: `batch-email` (or any path you want)
- **Method**: POST
- **Respond**: Immediately

### Step 2: Split Out Clients Node
- **Node Type**: Split Out
- **Field to Split Out**: `body.clients`

This will create parallel execution paths, one for each client.

### Step 3: Send Email Node (Gmail)
- **Resource**: Message
- **Operation**: Send
- **To**: `={{ $json.clientData.email }}`
- **Subject**: `={{ $json.emailSubject }}`
- **Message**: `={{ $json.emailContent }}`
- **Options**:
  - Continue on Fail: ✅ **ENABLED** (important!)

### Step 4: Check Success Node (IF)
- **Conditions**:
  - `{{ $json.error }}` is empty

This splits the path: success → update "Sent", failure → update "Failed"

### Step 5a: Update Status to "Sent" (Airtable)
- **Base ID**: `app3Gj45Ql7EwjLIg`
- **Table**: `Communications Corporate` (Table ID: `tbljseIDN7BhR2TyE`)
- **Operation**: Update
- **Record ID**: `={{ $json.junctionRecordId }}`  // ← THIS IS KEY
- **Fields to Update**:
  - `Status`: `Sent`

### Step 5b: Update Status to "Failed" (Airtable)
- **Base ID**: `app3Gj45Ql7EwjLIg`
- **Table**: `Communications Corporate` (Table ID: `tbljseIDN7BhR2TyE`)
- **Operation**: Update
- **Record ID**: `={{ $json.junctionRecordId }}`  // ← THIS IS KEY
- **Fields to Update**:
  - `Status`: `Failed`

## Testing Your Workflow

### 1. Test the Webhook Manually

In n8n, click **"Listen for Test Event"** on the Webhook node, then run this in your terminal:

```bash
curl -X POST https://your-n8n-instance.com/webhook/batch-email \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "batch",
    "batchId": "test_123",
    "timestamp": "2024-01-24T12:00:00Z",
    "totalClients": 1,
    "clients": [{
      "messageId": "recrUMgGhhA402p8R",
      "corporateId": "recOvWy22R57Z5btA",
      "junctionRecordId": "recQN4kpV3CwwB9No",
      "clientData": {
        "name": "DAME CONSULTING LLC",
        "email": "daniel.galindo@me.com"
      },
      "emailSubject": "Test Subject",
      "emailContent": "Test email content"
    }]
  }'
```

### 2. Test from Your App

1. Go to your app at `http://localhost:3000/communications`
2. Click **"Multiple Clients (Batch)"** mode
3. Create a test template in Airtable (or skip template)
4. Select 1-2 test clients
5. Fill in variables if needed
6. Click **Send Batch**
7. Check n8n execution logs

### 3. Verify in Airtable

Go to your Communications Corporate table and confirm:
- Status field changes from "Pending" → "Sent"
- The correct record (by `junctionRecordId`) was updated

## Debugging Tips

### Issue: "Record not found" in Airtable Update

**Cause**: The `junctionRecordId` isn't being passed correctly

**Fix**: Add a Code node before the Airtable update to log the value:

```javascript
const item = $input.first();
console.log('Junction Record ID:', item.json.junctionRecordId);
return [item];
```

Check the execution logs to see if the ID is present.

### Issue: Email sends but status doesn't update

**Cause**: Timing issue or the IF node isn't routing correctly

**Fix**:
1. Check the IF node condition: `{{ $json.error }}` should be **empty** for success path
2. Verify "Continue on Fail" is enabled on Gmail node
3. Check Airtable credentials have write permissions

### Issue: Workflow doesn't trigger

**Cause**: Webhook URL not configured or incorrect

**Fix**:
1. Copy the Production webhook URL from n8n
2. Add to your `.env` file in the server:
   ```
   N8N_WEBHOOK_URL=https://your-n8n.com/webhook/batch-email
   ```
3. Restart your server

## Environment Variables Checklist

**Server (packages/server/.env):**
```bash
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/batch-email
AIRTABLE_BASE_ID=app3Gj45Ql7EwjLIg
AIRTABLE_PERSONAL_ACCESS_TOKEN=pat...
```

**n8n Credentials:**
- ✅ Gmail OAuth2 configured
- ✅ Airtable Personal Access Token configured
- ✅ Token has write access to Communications Corporate table

## Success Criteria

- ✅ Batch communication sent from app
- ✅ n8n receives webhook with all clients
- ✅ Emails sent in parallel
- ✅ Status field updates to "Sent" in Airtable
- ✅ Failed emails update to "Failed" status

## Next Steps

1. Import the workflow from `n8n-workflows/simple-parallel-batch-workflow.json`
2. Configure your credentials (Gmail + Airtable)
3. Copy the Production webhook URL
4. Add `N8N_WEBHOOK_URL` to your server `.env`
5. Test with 1 client first
6. Scale to multiple clients

---

**Need help?** Check `N8N_TROUBLESHOOTING.md` for common issues and solutions.
