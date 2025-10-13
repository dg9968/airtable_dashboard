# Database Structure Recommendation
## Personal & Company Information Management

### Problem Statement
We manage:
- Personal contacts who can be individual service clients
- Companies that receive services
- Contacts who work for companies (relationship)
- Services that can be for individuals OR companies

### Recommended Structure

## 1. Core Tables

### Contacts (Persons)
**Purpose:** Individual people, regardless of company affiliation

Fields:
```
- Contact ID (Primary Key)
- First Name *
- Last Name *
- Personal Email
- Personal Phone
- Personal Address
- Date of Birth
- Language Preference
- Status (Active/Inactive)
- Type (Individual Client / Company Contact / Both)
- Notes
- Created Date
- Last Modified
```

### Companies
**Purpose:** Business entities that are clients

Fields:
```
- Company ID (Primary Key)
- Company Name *
- Business Registration Number
- Tax ID / EIN
- Company Email
- Company Phone
- Company Address
- Industry
- Website
- Registered Agent
- Status (Active/Inactive)
- Created Date
- Last Modified
```

### Company_Contacts (Relationship Table)
**Purpose:** Link contacts to companies with their role

Fields:
```
- Relationship ID (Primary Key)
- Contact ID * (→ Contacts)
- Company ID * (→ Companies)
- Role/Title (e.g., CEO, CFO, Accountant)
- Is Primary Contact (Boolean)
- Work Email (optional, may differ from personal)
- Work Phone (optional, may differ from personal)
- Department
- Start Date
- End Date (null if active)
- Status (Active/Inactive)
```

**Key Point:** This allows:
- One contact to work for multiple companies
- One company to have multiple contacts
- Track historical relationships (previous employees)

## 2. Services & Subscriptions

### Services
**Purpose:** Available service offerings

Fields:
```
- Service ID (Primary Key)
- Service Name *
- Service Type (Personal / Corporate / Both)
- Description
- Base Price
- Billing Frequency (Monthly/Quarterly/Annual)
- Category
- Status (Active/Inactive)
```

### Subscriptions
**Purpose:** Active service agreements

Fields:
```
- Subscription ID (Primary Key)
- Service ID * (→ Services)
- Client Type * ("Person" or "Company")
- Client ID * (Contact ID or Company ID)
- Contact Person ID (→ Contacts) - Who manages this subscription
- Status * (Active/Pending/Cancelled/Suspended)
- Billing Amount
- Start Date
- Renewal Date
- Assigned Processor (→ Users/Staff)
- Payment Method
- Notes
- Created Date
```

**Key Design Decision:**
- `Client Type` field determines if this subscription is for a person or company
- `Client ID` points to either Contacts table or Companies table
- `Contact Person ID` always points to a contact (for companies, it's who manages the service)

## 3. Query Patterns

### Get all subscriptions for a person (as individual client):
```sql
SELECT * FROM Subscriptions
WHERE Client_Type = 'Person' AND Client_ID = [contact_id]
```

### Get all subscriptions for a company:
```sql
SELECT * FROM Subscriptions
WHERE Client_Type = 'Company' AND Client_ID = [company_id]
```

### Get all companies a contact works for:
```sql
SELECT Companies.*
FROM Companies
JOIN Company_Contacts ON Companies.Company_ID = Company_Contacts.Company_ID
WHERE Company_Contacts.Contact_ID = [contact_id]
  AND Company_Contacts.Status = 'Active'
```

### Get all services managed by a specific contact:
```sql
-- Direct personal services
SELECT * FROM Subscriptions
WHERE Client_Type = 'Person' AND Client_ID = [contact_id]

UNION

-- Company services they manage
SELECT * FROM Subscriptions
WHERE Client_Type = 'Company' AND Contact_Person_ID = [contact_id]
```

## 4. Implementation in Airtable

### Table: Contacts
- Linked Records: Company_Contacts (many)
- Lookup: Companies via Company_Contacts

### Table: Companies
- Linked Records: Company_Contacts (many)
- Lookup: Contacts via Company_Contacts
- Rollup: Count of Active Contacts

### Table: Company_Contacts (Junction Table)
- Linked Record: Contact (single)
- Linked Record: Company (single)
- Fields: Role, Is Primary, Work Email, Work Phone

### Table: Subscriptions
- Single Select: Client Type (Person/Company)
- Linked Record: Client (formula to show either Contact or Company)
- Linked Record: Contact Person (always a Contact)
- Linked Record: Service
- Linked Record: Assigned Processor (from Users table)

## 5. Benefits of This Approach

✅ **Flexibility:**
- Contacts can be individual clients AND work for companies
- One contact can manage multiple company services
- Companies can have multiple contacts

✅ **No Data Duplication:**
- Contact information stored once
- Company information stored once
- Relationships tracked separately

✅ **Historical Tracking:**
- Track when someone left a company (End Date)
- Keep contact info even if they change companies
- Maintain subscription history

✅ **Clear Service Assignment:**
- Always know who to contact for a service
- Can assign services to individuals or companies
- Can track which processor handles each subscription

## 6. Migration Strategy

If migrating from current structure:

1. **Create Company_Contacts table** first
2. **Populate relationships** from existing data
3. **Update Subscriptions table** to add Client Type field
4. **Add Contact Person field** to all company subscriptions
5. **Update queries and views** to use new structure
6. **Test thoroughly** before removing old fields

## 7. API Considerations

When building APIs, create endpoints like:

```
GET  /api/contacts/:id                    # Get contact details
GET  /api/contacts/:id/companies          # Companies they work for
GET  /api/contacts/:id/subscriptions      # All subscriptions (personal + managed)

GET  /api/companies/:id                   # Get company details
GET  /api/companies/:id/contacts          # All company contacts
GET  /api/companies/:id/subscriptions     # All company subscriptions

GET  /api/subscriptions                   # All subscriptions
GET  /api/subscriptions?processor=X       # Filter by processor
GET  /api/subscriptions?clientType=Person # Filter by client type
```

## 8. Example Scenarios

### Scenario 1: John is an individual tax client
```
Contacts: { id: 1, name: "John Doe" }
Subscriptions: {
  client_type: "Person",
  client_id: 1,
  service: "Personal Tax Filing"
}
```

### Scenario 2: John also works for ABC Corp as CFO
```
Company_Contacts: {
  contact_id: 1,
  company_id: 100,
  role: "CFO",
  is_primary: true
}
```

### Scenario 3: ABC Corp has a bookkeeping service, John manages it
```
Subscriptions: {
  client_type: "Company",
  client_id: 100,
  contact_person_id: 1,
  service: "Bookkeeping"
}
```

### Result:
- John receives personal tax service
- John also gets notifications for ABC Corp's bookkeeping
- ABC Corp billing shows John as the contact
- If John leaves ABC Corp, update Company_Contacts (set End Date), assign new contact person to subscription
