# Company_Contacts Junction Table API Documentation

API endpoints for managing the many-to-many relationship between Contacts (persons) and Companies.

## Base URL
```
http://localhost:3001/api/company-contacts
```

## Endpoints

### 1. Get All Relationships

**GET** `/api/company-contacts`

Query all company-contact relationships with optional filters.

**Query Parameters:**
- `contactId` (optional) - Filter by specific contact
- `companyId` (optional) - Filter by specific company
- `status` (optional) - Filter by status (default: "Active")

**Examples:**
```bash
# Get all active relationships
curl http://localhost:3001/api/company-contacts

# Get all companies a contact works for
curl http://localhost:3001/api/company-contacts?contactId=rec123

# Get all contacts at a company
curl http://localhost:3001/api/company-contacts?companyId=recABC

# Get inactive relationships
curl http://localhost:3001/api/company-contacts?status=Inactive
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXYZ",
      "contactId": "rec123",
      "companyId": "recABC",
      "contactName": "John Doe",
      "companyName": "ABC Corp",
      "role": "CFO",
      "isPrimary": true,
      "workEmail": "john@abccorp.com",
      "workPhone": "+1-555-0100",
      "department": "Finance",
      "startDate": "2023-01-15",
      "endDate": null,
      "status": "Active",
      "createdTime": "2023-01-15T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Specific Relationship

**GET** `/api/company-contacts/:id`

Get details of a specific relationship by ID.

**Example:**
```bash
curl http://localhost:3001/api/company-contacts/recXYZ
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recXYZ",
    "contactId": "rec123",
    "companyId": "recABC",
    "contactName": "John Doe",
    "companyName": "ABC Corp",
    "role": "CFO",
    "isPrimary": true,
    "workEmail": "john@abccorp.com",
    "workPhone": "+1-555-0100",
    "department": "Finance",
    "startDate": "2023-01-15",
    "endDate": null,
    "status": "Active",
    "createdTime": "2023-01-15T10:00:00.000Z"
  }
}
```

---

### 3. Create Relationship

**POST** `/api/company-contacts`

Create a new relationship between a contact and a company.

**Request Body:**
```json
{
  "contactId": "rec123",
  "companyId": "recABC",
  "role": "CFO",
  "isPrimary": true,
  "workEmail": "john@abccorp.com",
  "workPhone": "+1-555-0100",
  "department": "Finance",
  "startDate": "2023-01-15",
  "status": "Active"
}
```

**Required Fields:**
- `contactId` - Airtable record ID of the contact
- `companyId` - Airtable record ID of the company

**Optional Fields:**
- `role` - Job title/role
- `isPrimary` - Boolean, is this the primary contact for the company?
- `workEmail` - Work email (may differ from personal)
- `workPhone` - Work phone (may differ from personal)
- `department` - Department name
- `startDate` - Start date (defaults to today)
- `status` - "Active" or "Inactive" (defaults to "Active")

**Example:**
```bash
curl -X POST http://localhost:3001/api/company-contacts \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "rec123",
    "companyId": "recABC",
    "role": "CFO",
    "isPrimary": true,
    "workEmail": "john@abccorp.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recNEW",
    "fields": {
      "Contact": ["rec123"],
      "Company": ["recABC"],
      "Role": "CFO",
      "Is Primary Contact": true,
      "Work Email": "john@abccorp.com",
      "Status": "Active",
      "Start Date": "2023-01-15"
    }
  }
}
```

---

### 4. Update Relationship

**PATCH** `/api/company-contacts/:id`

Update an existing relationship.

**Request Body (all fields optional):**
```json
{
  "role": "Chief Financial Officer",
  "isPrimary": true,
  "workEmail": "john.doe@abccorp.com",
  "workPhone": "+1-555-0200",
  "department": "Executive",
  "endDate": "2024-12-31",
  "status": "Inactive"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3001/api/company-contacts/recXYZ \
  -H "Content-Type: application/json" \
  -d '{
    "role": "Chief Financial Officer",
    "workPhone": "+1-555-0200"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "recXYZ",
    "fields": {
      "Role": "Chief Financial Officer",
      "Work Phone": "+1-555-0200"
    }
  }
}
```

---

### 5. Delete/Deactivate Relationship

**DELETE** `/api/company-contacts/:id`

Delete or deactivate a relationship.

**Query Parameters:**
- `hard` (optional) - Set to "true" to permanently delete, otherwise soft delete (default)

**Soft Delete (Default):**
Sets status to "Inactive" and adds end date.

```bash
curl -X DELETE http://localhost:3001/api/company-contacts/recXYZ
```

**Hard Delete:**
Permanently removes the record.

```bash
curl -X DELETE "http://localhost:3001/api/company-contacts/recXYZ?hard=true"
```

**Response (Soft Delete):**
```json
{
  "success": true,
  "message": "Relationship deactivated",
  "data": {
    "id": "recXYZ",
    "fields": {
      "Status": "Inactive",
      "End Date": "2024-01-15"
    }
  }
}
```

**Response (Hard Delete):**
```json
{
  "success": true,
  "message": "Relationship permanently deleted"
}
```

---

### 6. Get Companies for Contact

**GET** `/api/company-contacts/contact/:contactId/companies`

Get all companies a specific contact works for.

**Query Parameters:**
- `status` (optional) - Filter by status (default: "Active")

**Example:**
```bash
# Get active companies
curl http://localhost:3001/api/company-contacts/contact/rec123/companies

# Get all companies (including past)
curl "http://localhost:3001/api/company-contacts/contact/rec123/companies?status=Inactive"
```

**Response:**
```json
{
  "success": true,
  "contactId": "rec123",
  "companies": [
    {
      "relationshipId": "recXYZ",
      "companyId": "recABC",
      "companyName": "ABC Corp",
      "role": "CFO",
      "isPrimary": true,
      "workEmail": "john@abccorp.com",
      "workPhone": "+1-555-0100",
      "department": "Finance",
      "startDate": "2023-01-15",
      "endDate": null
    },
    {
      "relationshipId": "recDEF",
      "companyId": "recGHI",
      "companyName": "XYZ Inc",
      "role": "Consultant",
      "isPrimary": false,
      "workEmail": "john.consultant@xyzinc.com",
      "workPhone": "+1-555-0200",
      "department": "Advisory",
      "startDate": "2024-03-01",
      "endDate": null
    }
  ],
  "count": 2
}
```

---

### 7. Get Contacts for Company

**GET** `/api/company-contacts/company/:companyId/contacts`

Get all contacts who work at a specific company.

**Query Parameters:**
- `status` (optional) - Filter by status (default: "Active")

**Example:**
```bash
# Get active contacts
curl http://localhost:3001/api/company-contacts/company/recABC/contacts

# Get all contacts (including former employees)
curl "http://localhost:3001/api/company-contacts/company/recABC/contacts?status=Inactive"
```

**Response:**
```json
{
  "success": true,
  "companyId": "recABC",
  "contacts": [
    {
      "relationshipId": "recXYZ",
      "contactId": "rec123",
      "contactName": "John Doe",
      "role": "CFO",
      "isPrimary": true,
      "workEmail": "john@abccorp.com",
      "workPhone": "+1-555-0100",
      "department": "Finance",
      "startDate": "2023-01-15",
      "endDate": null
    },
    {
      "relationshipId": "recABC",
      "contactId": "rec456",
      "contactName": "Jane Smith",
      "role": "CEO",
      "isPrimary": false,
      "workEmail": "jane@abccorp.com",
      "workPhone": "+1-555-0101",
      "department": "Executive",
      "startDate": "2022-06-01",
      "endDate": null
    }
  ],
  "count": 2
}
```

---

### 8. Set Primary Contact

**POST** `/api/company-contacts/contact/:contactId/set-primary`

Set a contact as the primary contact for a specific company. This automatically sets all other contacts for that company to non-primary.

**Request Body:**
```json
{
  "companyId": "recABC"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/company-contacts/contact/rec123/set-primary \
  -H "Content-Type: application/json" \
  -d '{"companyId": "recABC"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Primary contact updated",
  "data": {
    "id": "recXYZ",
    "fields": {
      "Is Primary Contact": true
    }
  }
}
```

---

## Common Use Cases

### Use Case 1: Person Joins Company

When John Doe starts working at ABC Corp as CFO:

```bash
curl -X POST http://localhost:3001/api/company-contacts \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "rec_johndoe",
    "companyId": "rec_abccorp",
    "role": "CFO",
    "isPrimary": true,
    "workEmail": "john.doe@abccorp.com",
    "workPhone": "+1-555-1234",
    "department": "Finance",
    "startDate": "2024-01-15"
  }'
```

### Use Case 2: Person Changes Role

John gets promoted from CFO to CEO:

```bash
curl -X PATCH http://localhost:3001/api/company-contacts/rec_relationship \
  -H "Content-Type: application/json" \
  -d '{
    "role": "CEO",
    "department": "Executive"
  }'
```

### Use Case 3: Person Leaves Company

John leaves ABC Corp:

```bash
# Soft delete (recommended - keeps history)
curl -X DELETE http://localhost:3001/api/company-contacts/rec_relationship
```

This sets:
- Status: "Inactive"
- End Date: Today's date

### Use Case 4: Get All of John's Companies

Get all companies John works for (including consultancy roles):

```bash
curl http://localhost:3001/api/company-contacts/contact/rec_johndoe/companies
```

### Use Case 5: Get All Contacts at ABC Corp

Get company directory:

```bash
curl http://localhost:3001/api/company-contacts/company/rec_abccorp/contacts
```

### Use Case 6: Set New Primary Contact

After John leaves, set Jane as primary:

```bash
curl -X POST http://localhost:3001/api/company-contacts/contact/rec_janesmith/set-primary \
  -H "Content-Type: application/json" \
  -d '{"companyId": "rec_abccorp"}'
```

---

## Airtable Setup Required

Create a table in Airtable called `Company_Contacts` with these fields:

### Required Fields:
- **Contact** - Linked Record field → Contacts table (single)
- **Company** - Linked Record field → Companies table (single)
- **Status** - Single Select: "Active", "Inactive" (default: "Active")

### Optional Fields:
- **Role** - Single Line Text (e.g., "CFO", "CEO", "Accountant")
- **Is Primary Contact** - Checkbox (boolean)
- **Work Email** - Email field
- **Work Phone** - Phone field
- **Department** - Single Line Text
- **Start Date** - Date field
- **End Date** - Date field (null if still active)

### Formula Fields (for convenience):
- **Contact ID** - Formula: `RECORD_ID()` from Contact linked record
- **Company ID** - Formula: `RECORD_ID()` from Company linked record
- **Contact Name** - Lookup from Contact table
- **Company Name** - Lookup from Company table

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing required fields)
- `404` - Not Found
- `409` - Conflict (relationship already exists)
- `500` - Server Error
