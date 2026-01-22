# Communications Feature - Technical Documentation

## Overview

The Communications feature enables staff and admin users to send emails to corporate clients directly from the dashboard. The system integrates with Airtable for data storage and uses an n8n webhook for email delivery.

## Architecture

### Flow Diagram

```
User Interface (Communications Page)
    ↓
1. Create Message Record (Airtable: Messages table)
    ↓
2. Create Junction Record (Airtable: Communications Corporate table)
    ↓
3. Trigger n8n Webhook (Email Delivery)
    ↓
Email Sent to Corporate Client
```

## Components

### Frontend Components

#### **1. CommunicationsPage** (`packages/client/app/communications/page.tsx`)

- **Route:** `/communications`
- **Access:** Staff and Admin only (protected route)
- **Purpose:** Main page wrapper with header and layout
- **Features:**
  - Role-based access control via ProtectedRoute
  - Page header with title and description
  - Renders CommunicationsForm component

#### **2. CommunicationsForm** (`packages/client/components/CommunicationsForm.tsx`)

- **Purpose:** Main form for composing and sending emails
- **Features:**
  - Corporate client search and selection
  - Email subject input
  - Email content textarea
  - Form validation
  - Success/error message display
  - Clear and Send buttons

**State Management:**

- `selectedClient`: Currently selected corporate client
- `emailSubject`: Email subject line
- `emailContent`: Email body text
- `isSending`: Loading state during send operation
- `error`: Error messages
- `successMessage`: Success confirmation

**Workflow:**

1. User searches and selects a corporate client
2. User enters email subject and content
3. User clicks "Send Email"
4. Form validates all required fields
5. Creates Message record in Airtable
6. Creates Communications Corporate junction record
7. Triggers n8n webhook for email delivery
8. Displays success message and resets form

#### **3. CorporateClientSearch** (`packages/client/components/CorporateClientSearch.tsx`)

- **Purpose:** Reusable search component for finding corporate clients
- **Features:**
  - Debounced search (500ms delay)
  - Live search results dropdown
  - Client details display
  - Clear selection functionality
  - Loading and error states

**Search Capabilities:**

- Search by company name
- Search by EIN (Tax ID)
- Search by entity number

**Client Information Displayed:**

- Company name
- Client code
- EIN
- Entity number
- Address (city, state, zip)
- Phone number

### Backend API Routes

#### **1. Messages API** (`packages/server/src/routes/messages.ts`)

**Endpoint:** `POST /api/messages`

**Purpose:** Creates a new message record in Airtable

**Request Body:**

```json
{
  "emailSubject": "Subject line",
  "emailContent": "Email body text"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "recXXXXXXXXXXXXXX",
    "fields": {
      "Email Subject": "Subject line",
      "Email Content": "Email body text"
    }
  }
}
```

**Airtable Table:** Messages

- Field: `Email Subject` (Single line text)
- Field: `Email Content` (Long text)

---

#### **2. Communications Corporate API** (`packages/server/src/routes/communications-corporate.ts`)

**Endpoint:** `POST /api/communications-corporate`

**Purpose:** Creates junction record linking Message to Corporate client

**Request Body:**

```json
{
  "messageId": "recXXXXXXXXXXXXXX",
  "corporateId": "recYYYYYYYYYYYYYY"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "recZZZZZZZZZZZZZZ",
    "fields": {
      "Message": ["recXXXXXXXXXXXXXX"],
      "Company": ["recYYYYYYYYYYYYYY"]
    }
  }
}
```

**Airtable Table:** Communications Corporate

- Field: `Message` (Link to Messages table)
- Field: `Company` (Link to Corporations table)

---

#### **3. Communications Webhook API** (`packages/server/src/routes/communications-webhook.ts`)

**Endpoint:** `POST /api/communications-webhook/trigger`

**Purpose:** Triggers n8n webhook to send email

**Request Body:**

```json
{
  "messageId": "recXXXXXXXXXXXXXX",
  "corporateId": "recYYYYYYYYYYYYYY",
  "emailSubject": "Subject line",
  "emailContent": "Email body text",
  "junctionRecordId": "recZZZZZZZZZZZZZZ",
  "timestamp": "2024-01-21T12:00:00.000Z"
}
```

**Environment Variable Required:**

```
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/communications
```

**Response:**

```json
{
  "success": true,
  "message": "Webhook triggered successfully"
}
```

---

### Client-Side API Proxies

All frontend API calls go through Next.js API routes that proxy to the Hono backend:

- `packages/client/app/api/messages/route.ts`
- `packages/client/app/api/communications-corporate/route.ts`
- `packages/client/app/api/communications-webhook/trigger/route.ts`

These proxies handle authentication headers and forward requests to the backend server.

---

## Airtable Schema

### Required Tables

#### **1. Messages**

- Purpose: Stores email message content
- Fields:
  - `Email Subject` (Single line text) - Required
  - `Email Content` (Long text) - Required
  - Created time (auto)

#### **2. Communications Corporate**

- Purpose: Junction table linking messages to corporate clients
- Fields:
  - `Message` (Link to Messages) - Required
  - `Company` (Link to Corporations) - Required
  - Created time (auto)

#### **3. Corporations** (Existing)

- Purpose: Corporate client records
- Must have: Company name, EIN, Entity number, Email address

---

## n8n Webhook Integration

### Webhook Configuration

The n8n workflow should be configured to:

1. **Receive webhook POST request** with payload containing:
   - `messageId`: Airtable record ID from Messages table
   - `corporateId`: Airtable record ID from Corporations table
   - `emailSubject`: Email subject line
   - `emailContent`: Email body content
   - `junctionRecordId`: Airtable record ID from Communications Corporate
   - `timestamp`: ISO timestamp of when email was sent

2. **Fetch corporate client details** from Airtable:
   - Use `corporateId` to get company name and email address
   - Lookup fields: Company Name, Email

3. **Send email** via email service (e.g., SendGrid, SMTP, Gmail):
   - To: Client's email address
   - Subject: `emailSubject`
   - Body: `emailContent`
   - Optional: Add company branding, signature, footer

4. **Update Airtable** (optional):
   - Update Communications Corporate record with delivery status
   - Add timestamp of email delivery
   - Log any errors

### Environment Setup

Add to `packages/server/.env`:

```bash
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/communications
```

---

## Navigation

The Communications feature is accessible from:

**Desktop Menu:**

- Location: Header dropdown under Staff/Admin section
- Path: Business Management → Communications

**Mobile Menu:**

- Location: Mobile nav drawer
- Section: Staff/Admin tools

**Implementation:**
File: `packages/client/components/Header.tsx`

---

## Security & Access Control

### Authentication

- Uses NextAuth.js session-based authentication
- Protected routes verify user is logged in

### Authorization

- **Allowed Roles:** Staff, Admin
- **Restricted:** Regular users cannot access
- Implemented via `ProtectedRoute` component

### Data Protection

- All API routes require authentication
- Airtable credentials stored in environment variables
- n8n webhook URL kept secret in environment config

---

## Error Handling

### Frontend Errors

- Network failures: Display error alert
- Validation errors: Inline field validation
- API errors: Parse and display error messages
- Auto-dismiss: Success messages fade after 5 seconds

### Backend Errors

- Missing fields: 400 Bad Request with descriptive message
- Airtable connection: 401 Unauthorized if credentials invalid
- Webhook failures: 500 Internal Server Error with details
- All errors logged to console for debugging

---

## Usage Guide

### For End Users (Staff/Admin)

1. **Navigate to Communications**
   - Click "Communications" in the header menu

2. **Search for Client**
   - Type company name, EIN, or entity number in search box
   - Wait for dropdown results (debounced 500ms)
   - Click on desired client from results

3. **Compose Email**
   - Enter subject line
   - Type or paste email content
   - Review client details shown

4. **Send Email**
   - Click "Send Email" button
   - Wait for confirmation message
   - Form will auto-clear on success

5. **Handle Errors**
   - If error occurs, read error message
   - Fix issue (e.g., missing fields)
   - Try sending again

### For Developers

#### Adding Email Templates

To add pre-defined email templates:

1. Create template constant in `CommunicationsForm.tsx`:

```typescript
const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Welcome to [Company Name]",
    content: "Dear [Client Name],\n\nWelcome aboard!...",
  },
  reminder: {
    subject: "Reminder: [Action Required]",
    content: "Dear [Client Name],\n\nThis is a reminder...",
  },
};
```

2. Add template selector UI:

```tsx
<select
  onChange={(e) => {
    const template = EMAIL_TEMPLATES[e.target.value];
    setEmailSubject(template.subject);
    setEmailContent(template.content);
  }}
>
  <option value="">Select template...</option>
  <option value="welcome">Welcome Email</option>
  <option value="reminder">Reminder Email</option>
</select>
```

#### Extending to Personal Clients

To add communications for personal (individual) clients:

1. Create `CommunicationsPersonal` table in Airtable
2. Copy and modify `communications-corporate.ts` routes
3. Create `PersonalClientSearch` component
4. Add route for personal communications page
5. Update Header navigation

---

## Testing

### Manual Testing Checklist

- [ ] Can access Communications page as Staff
- [ ] Can access Communications page as Admin
- [ ] Cannot access as regular user (redirected)
- [ ] Search finds corporate clients by name
- [ ] Search finds corporate clients by EIN
- [ ] Search finds corporate clients by entity number
- [ ] Selected client displays correct details
- [ ] Cannot send email with empty subject
- [ ] Cannot send email with empty content
- [ ] Cannot send email without selecting client
- [ ] Email sends successfully with all fields filled
- [ ] Success message displays after sending
- [ ] Form clears after successful send
- [ ] Error message displays on API failure
- [ ] Clear button resets form
- [ ] Debounced search doesn't spam API

### API Testing

```bash
# 1. Create message
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"emailSubject":"Test","emailContent":"Test message"}'

# 2. Create communications record
curl -X POST http://localhost:3001/api/communications-corporate \
  -H "Content-Type: application/json" \
  -d '{"messageId":"recXXX","corporateId":"recYYY"}'

# 3. Trigger webhook
curl -X POST http://localhost:3001/api/communications-webhook/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "messageId":"recXXX",
    "corporateId":"recYYY",
    "emailSubject":"Test",
    "emailContent":"Test message",
    "junctionRecordId":"recZZZ",
    "timestamp":"2024-01-21T12:00:00.000Z"
  }'
```

---

## Troubleshooting

### Issue: "Failed to create message"

- **Check:** Airtable credentials in `.env`
- **Check:** Messages table exists with correct fields
- **Check:** Field names match exactly (`Email Subject`, `Email Content`)

### Issue: "Failed to create communications record"

- **Check:** Communications Corporate table exists
- **Check:** Message and Company link fields configured
- **Check:** Corporate client ID is valid

### Issue: "Failed to trigger webhook"

- **Check:** `N8N_WEBHOOK_URL` environment variable is set
- **Check:** n8n instance is running and accessible
- **Check:** Webhook endpoint exists and is active
- **Check:** n8n workflow is deployed (not just saved)

### Issue: Search returns no results

- **Check:** Corporate clients exist in Corporations table
- **Check:** Companies have names, EINs, or entity numbers
- **Check:** Search API route is working (`/api/companies/search`)

### Issue: Email not received

- **Check:** n8n webhook execution logs
- **Check:** Client email address in Airtable is valid
- **Check:** Email service configuration in n8n
- **Check:** Spam folder on recipient end

---

## Future Enhancements

### Potential Features

1. **Email History**
   - View past communications with client
   - Filter by date range, client, or subject
   - Resend previous emails

2. **Attachments**
   - Upload files to attach to emails
   - Link documents from document management system
   - Support multiple attachments

3. **CC/BCC**
   - Add additional recipients
   - Copy team members on emails
   - BCC for record-keeping

4. **Rich Text Editor**
   - Formatting options (bold, italic, lists)
   - Insert images and links
   - HTML email templates

5. **Bulk Emails**
   - Select multiple clients
   - Send same email to group
   - Mail merge with client-specific data

6. **Scheduled Emails**
   - Schedule send for future date/time
   - Set up recurring communications
   - Automated reminder emails

7. **Read Receipts**
   - Track when emails are opened
   - Click tracking for links
   - Delivery status updates

8. **Email Templates Management**
   - Save frequently used emails as templates
   - Template variables for personalization
   - Share templates across team

---

## Related Documentation

- [Adding Corporate Services](./ADDING_CORPORATE_SERVICES.md) - Guide for adding new services
- [Database Structure](../DATABASE_STRUCTURE_RECOMMENDATION.md) - Airtable schema design
- [CLAUDE.md](../CLAUDE.md) - Development environment setup

---

## Support

For issues or questions about the Communications feature:

1. Check troubleshooting section above
2. Review n8n webhook logs
3. Check Airtable table structure
4. Verify environment variables
5. Test API endpoints directly

## Changelog

- **2024-01-21**: Initial communications feature implementation
  - Created Messages and Communications Corporate tables
  - Implemented CommunicationsForm component
  - Added CorporateClientSearch with debouncing
  - Integrated n8n webhook for email delivery
  - Added navigation links in Header
