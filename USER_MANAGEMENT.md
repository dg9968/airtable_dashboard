# User Management Guide

This guide shows you how to look up and manage users in your Airtable Dashboard.

## 🛠️ Tools Available

You have **three ways** to manage users:

1. **Command Line Script** (Easiest) ⭐ **Recommended**
2. **Postman/API Calls** (For testing APIs)
3. **Direct Airtable** (Manual)

---

## 1. Command Line Script (Easiest)

### Quick Start

**List all users:**
```bash
bun run scripts/manage-users.ts list
```

**Find a specific user:**
```bash
bun run scripts/manage-users.ts find admin@example.com
```

**Create a new user (interactive):**
```bash
bun run scripts/manage-users.ts create
```

### All Commands

```bash
# List all users
bun run scripts/manage-users.ts list

# Find user by email
bun run scripts/manage-users.ts find user@example.com

# Create user (interactive - asks for details)
bun run scripts/manage-users.ts create

# Create user (one command)
bun run scripts/manage-users.ts create admin@test.com "Admin User" "password123" admin

# Delete user
bun run scripts/manage-users.ts delete user@example.com

# Activate user account
bun run scripts/manage-users.ts activate user@example.com

# Deactivate user account
bun run scripts/manage-users.ts deactivate user@example.com
```

### Example Session

```bash
# See who's in the database
$ bun run scripts/manage-users.ts list

📋 Listing all users...

Found 2 user(s):

1. Admin User
   Email:  admin@example.com
   Role:   admin
   Active: ✓
   ID:     rec123abc

2. Test User
   Email:  test@example.com
   Role:   user
   Active: ✓
   ID:     rec456def

# Look up a specific user
$ bun run scripts/manage-users.ts find admin@example.com

🔍 Searching for user: admin@example.com...

✅ User found:
   Name:   Admin User
   Email:  admin@example.com
   Role:   admin
   Active: Yes ✓
   ID:     rec123abc

# Create your first admin user
$ bun run scripts/manage-users.ts create

🆕 Create New User

Email: myemail@example.com
Name: My Name
Password: securepassword123
Role (admin/staff/user) [user]: admin

➕ Creating user: myemail@example.com...

✅ User created successfully!
   Name:  My Name
   Email: myemail@example.com
   Role:  admin
   ID:    rec789xyz
```

### Quick Create First Admin

If you need to create your first admin user quickly:

```bash
bun run scripts/manage-users.ts create admin@yourdomain.com "Admin User" "YourSecurePassword123" admin
```

Then login at: http://localhost:3000/auth/signin

---

## 2. Postman / API Testing

### Import Collection

1. Open Postman
2. Click **Import**
3. Select file: `POSTMAN_COLLECTION.json`
4. Collection "Airtable Dashboard API" will be added

### Available Endpoints

**Health Check:**
```
GET http://localhost:3001/health
```
No auth required. Should return: `{"status":"ok"}`

**Get Session:**
```
GET http://localhost:3000/api/auth/session
```
Returns current session or `{}`

**Create User (requires admin auth):**
```
POST http://localhost:3000/api/auth/create-user
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "password123",
  "role": "user"
}
```

### Testing Authentication Flow

1. **Login** (in browser):
   - Go to http://localhost:3000/auth/signin
   - Enter credentials
   - This sets cookies

2. **Get Session** (in Postman):
   - Make sure cookies are enabled in Postman
   - GET http://localhost:3000/api/auth/session
   - Should return your user info

3. **Create User** (in Postman with session):
   - POST http://localhost:3000/api/auth/create-user
   - Include body with user details
   - Works only if logged in as admin

---

## 3. Direct Airtable Access

### View Users

1. Go to https://airtable.com
2. Open your base
3. Go to "Users" table
4. You'll see all users with their details

### User Fields

| Field | Type | Description |
|-------|------|-------------|
| Email | Single line text | User's email (unique) |
| Name | Single line text | Display name |
| PasswordHash | Long text | bcrypt hashed password |
| Role | Single select | admin, staff, or user |
| IsActive | Checkbox | Account enabled/disabled |

### Create User in Airtable

**⚠️ Not Recommended** - Use the script instead!

If you must create a user directly in Airtable:

1. Click **+** to add a record
2. Fill in fields:
   - **Email**: user@example.com
   - **Name**: User Name
   - **Role**: user (or admin, staff)
   - **IsActive**: ✓ (checked)
   - **PasswordHash**: You need to hash the password

3. To get PasswordHash:
   ```bash
   cd packages/client
   node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
   ```

4. Copy the hash output and paste into PasswordHash field

**Much easier to use the script!** 😊

---

## 🎯 Common Tasks

### Create Your First Admin User

**Fastest way:**
```bash
bun run scripts/manage-users.ts create admin@example.com "Admin" "SecurePass123!" admin
```

Then login at http://localhost:3000/auth/signin

### Check If User Exists

```bash
bun run scripts/manage-users.ts find user@example.com
```

### See All Users

```bash
bun run scripts/manage-users.ts list
```

### Temporarily Disable a User

```bash
bun run scripts/manage-users.ts deactivate user@example.com
```

They won't be able to login. To re-enable:

```bash
bun run scripts/manage-users.ts activate user@example.com
```

### Delete a User

```bash
bun run scripts/manage-users.ts delete user@example.com
```

**Warning:** This permanently deletes the user from Airtable!

---

## 🔐 User Roles

### admin
- Full access to everything
- Can create new users
- Can access /admin routes
- Can manage all features

### staff
- Access to dashboards and data
- Can process documents
- Cannot create users
- Cannot access admin areas

### user
- Basic access
- Can view own data
- Limited features
- No admin capabilities

---

## 🧪 Testing Workflow

### 1. Create Test Users

```bash
# Create admin
bun run scripts/manage-users.ts create admin@test.com "Admin" "admin123" admin

# Create staff member
bun run scripts/manage-users.ts create staff@test.com "Staff" "staff123" staff

# Create regular user
bun run scripts/manage-users.ts create user@test.com "User" "user123" user
```

### 2. Verify They Exist

```bash
bun run scripts/manage-users.ts list
```

Should show all 3 users.

### 3. Test Login

Visit http://localhost:3000/auth/signin and try each user.

### 4. Test Permissions

- Login as admin → Should access everything
- Login as staff → Should access dashboards, not admin
- Login as user → Limited access

---

## 🆘 Troubleshooting

### "Missing Airtable credentials"

**Fix:** Make sure `packages/server/.env` has:
```env
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_USERS_TABLE=Users
```

### "User not found" when they exist

**Cause:** Email doesn't match exactly (case-sensitive)

**Fix:** List all users to see exact email:
```bash
bun run scripts/manage-users.ts list
```

### "Cannot find module 'airtable'"

**Fix:** Install dependencies:
```bash
bun install
```

### Script shows "No users found"

**Cause:** Either:
1. No users in database yet
2. Table name is wrong
3. Connection issue

**Fix:**
1. Create first user:
   ```bash
   bun run scripts/manage-users.ts create
   ```

2. Check table name in `.env`:
   ```env
   AIRTABLE_USERS_TABLE=Users
   ```

3. Verify Airtable connection by checking the base online

---

## 📋 Quick Reference

```bash
# Most common commands
bun run scripts/manage-users.ts list                    # See all users
bun run scripts/manage-users.ts find <email>            # Find one user
bun run scripts/manage-users.ts create                  # Create user (interactive)
bun run scripts/manage-users.ts create <email> <name> <pass> <role>  # Create user (direct)

# Less common
bun run scripts/manage-users.ts delete <email>          # Delete user
bun run scripts/manage-users.ts activate <email>        # Enable account
bun run scripts/manage-users.ts deactivate <email>      # Disable account
```

---

## 📚 Related Documentation

- [AUTH_SETUP.md](./AUTH_SETUP.md) - Authentication setup guide
- [SUCCESS.md](./SUCCESS.md) - What's working
- [NEXT_STEPS.md](./NEXT_STEPS.md) - Continue development

---

**Need to create your first user?**

Run this right now:
```bash
bun run scripts/manage-users.ts create
```

Then login at http://localhost:3000/auth/signin! 🎉
