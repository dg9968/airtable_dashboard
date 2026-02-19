# n8n + SignNow Integration Setup Guide

Complete guide for setting up document signing automation with n8n and SignNow.

---

## Prerequisites

- SignNow account (with API access)
- n8n instance (Cloud or self-hosted)
- SignNow API credentials (Client ID & Secret)

---

## Step 1: Get SignNow API Credentials

1. Log into [SignNow](https://app.signnow.com)
2. Go to **Settings** → **API** → **Keys**
3. Create a new application or use existing
4. Copy your:
   - **Client ID**
   - **Client Secret**
   - **API Base URL**: `https://api.signnow.com`

---

## Step 2: Create OAuth2 Credentials in n8n

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **OAuth2 API**
3. Configure:

| Field | Value |
|-------|-------|
| Grant Type | Client Credentials |
| Access Token URL | `https://api.signnow.com/oauth2/token` |
| Client ID | Your SignNow Client ID |
| Client Secret | Your SignNow Client Secret |
| Scope | `*` |
| Authentication | Header |

4. Save the credential

---

## Step 3: Workflow Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Trigger   │ → │   Upload    │ → │  Add Fields │ → │   Create    │
│  (Webhook/  │    │  Document   │    │ (Optional)  │    │   Invite    │
│   Manual)   │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Step 4: Node Configurations

### Node 1: Trigger

Use one of these triggers:
- **Webhook**: Receive document from external system
- **Manual Trigger**: For testing
- **Airtable Trigger**: When a record is created/updated

---

### Node 2: Upload Document

**HTTP Request Node**

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://api.signnow.com/document` |
| Authentication | Predefined Credential Type → OAuth2 |
| Credential | Your SignNow OAuth2 credential |

**Headers:**
```
Content-Type: multipart/form-data
```

**Body (Form-Data):**

| Name | Value |
|------|-------|
| file | `{{ $binary.data }}` (binary data from previous node) |

**Response contains:**
```json
{
  "id": "document_id_here"
}
```

---

### Node 3: Add Signature Fields (Required for Field Invites)

**HTTP Request Node**

| Setting | Value |
|---------|-------|
| Method | PUT |
| URL | `https://api.signnow.com/document/{{ $json.id }}` |
| Authentication | OAuth2 |

**Body (JSON):**
```json
{
  "fields": [
    {
      "type": "signature",
      "x": 100,
      "y": 600,
      "width": 200,
      "height": 50,
      "page_number": 0,
      "role": "Signer",
      "required": true,
      "label": "Client Signature"
    },
    {
      "type": "text",
      "x": 100,
      "y": 680,
      "width": 200,
      "height": 20,
      "page_number": 0,
      "role": "Signer",
      "required": true,
      "label": "Date",
      "prefilled_text": ""
    }
  ]
}
```

**Field Types Available:**
- `signature` - Signature field
- `text` - Text input
- `initials` - Initials field
- `checkbox` - Checkbox
- `date` - Date field
- `dropdown` - Dropdown select

---

### Node 4: Create Invite (Send for Signing)

**HTTP Request Node**

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://api.signnow.com/document/{{ $json.id }}/invite` |
| Authentication | OAuth2 |

**Body (JSON) - Field Invite:**
```json
{
  "from": "your-signnow-email@company.com",
  "to": [
    {
      "email": "{{ $json.signerEmail }}",
      "role": "Signer",
      "order": 1,
      "reassign": 0,
      "decline_by_signature": 0,
      "reminder": 0,
      "expiration_days": 30,
      "subject": "Please sign: {{ $json.documentName }}",
      "message": "Please review and sign the attached document."
    }
  ]
}
```

**Body (JSON) - Freeform Invite (No pre-placed fields):**
```json
{
  "from": "your-signnow-email@company.com",
  "to": "{{ $json.signerEmail }}",
  "subject": "Please sign this document",
  "message": "Please review and sign where indicated."
}
```

---

## Step 5: Handle Multiple Signers

For documents requiring multiple signatures in order:

```json
{
  "from": "sender@company.com",
  "to": [
    {
      "email": "first-signer@email.com",
      "role": "Client",
      "order": 1
    },
    {
      "email": "second-signer@email.com",
      "role": "Witness",
      "order": 2
    },
    {
      "email": "final-approver@company.com",
      "role": "Manager",
      "order": 3
    }
  ]
}
```

---

## Step 6: Webhook for Completion (Optional)

### Create Event Subscription

**HTTP Request Node** (run once to set up)

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | `https://api.signnow.com/event_subscription` |

**Body:**
```json
{
  "event": "document.complete",
  "callback_url": "https://your-n8n-instance.com/webhook/signnow-complete"
}
```

**Available Events:**
- `document.complete` - All parties signed
- `document.decline` - Signer declined
- `document.viewed` - Document opened
- `invite.sent` - Invite sent successfully

### Webhook Trigger Node

Create a separate workflow with a Webhook node:
- **HTTP Method**: POST
- **Path**: `signnow-complete`

This will receive:
```json
{
  "event": "document.complete",
  "document_id": "xxx",
  "timestamp": "2026-02-16T21:00:00Z"
}
```

---

## Step 7: Download Signed Document

**HTTP Request Node**

| Setting | Value |
|---------|-------|
| Method | GET |
| URL | `https://api.signnow.com/document/{{ $json.document_id }}/download?type=collapsed` |
| Response Format | File |

**Query Parameters:**
- `type=collapsed` - Single PDF with all signatures
- `type=zip` - ZIP with separate files

---

## Complete Workflow Example

```
1. Webhook Trigger (receive document request)
        ↓
2. HTTP Request: Get file from URL/S3/Airtable
        ↓
3. HTTP Request: Upload to SignNow
   POST https://api.signnow.com/document
        ↓
4. HTTP Request: Add signature fields
   PUT https://api.signnow.com/document/{id}
        ↓
5. HTTP Request: Create invite
   POST https://api.signnow.com/document/{id}/invite
        ↓
6. Update Airtable/Database with envelope ID
        ↓
7. (Separate workflow) Webhook receives completion
        ↓
8. HTTP Request: Download signed document
        ↓
9. Upload to S3/Google Drive/Airtable
```

---

## Troubleshooting

### Error: "From must not be empty"
- Add `"from": "your-email@domain.com"` to invite body
- Must be your SignNow account email

### Error: "Document does not contain fields"
- Either add fields via PUT request before invite
- Or use freeform invite (simpler `to` format)

### Error: "Unauthorized"
- Check OAuth2 credentials
- Verify token hasn't expired
- Regenerate credentials if needed

### Error: "Role not found"
- Role in invite must match role in fields
- Check spelling: "Signer" vs "signer" (case-sensitive)

---

## Field Positioning Tips

SignNow coordinates:
- Origin (0,0) is **top-left** of page
- Units are in **pixels** (72 pixels = 1 inch)
- Standard letter page: ~612 x 792 pixels

**Common positions:**
| Location | x | y |
|----------|---|---|
| Top-left | 50 | 50 |
| Top-right | 400 | 50 |
| Bottom-left | 50 | 700 |
| Bottom-right | 400 | 700 |
| Center | 200 | 400 |

---

## Using Templates Instead

If you have repeatable documents:

1. Create template in SignNow web UI with pre-placed fields
2. Get template ID from SignNow
3. Use this workflow:

```
POST https://api.signnow.com/template/{template_id}/copy
→ Returns new document_id with fields already placed
→ Send invite directly (no need to add fields)
```

---

## API Reference Links

- [SignNow API Docs](https://docs.signnow.com/docs)
- [Authentication](https://docs.signnow.com/docs/authentication)
- [Documents API](https://docs.signnow.com/docs/documents)
- [Invites API](https://docs.signnow.com/docs/invites)
- [Webhooks](https://docs.signnow.com/docs/webhooks)
