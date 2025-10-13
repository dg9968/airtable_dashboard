# Authentication Setup Guide

## ✅ Good News!

Your authentication system is **working correctly**! The error you're seeing:

```
Error fetching user from Airtable: AirtableError {
  error: 'NOT_FOUND',
  message: 'Could not find what you are looking for',
  statusCode: 404
}
```

This means:
- ✅ NextAuth is configured and running
- ✅ Connection to Airtable is working
- ✅ Authentication flow is executing
- ❌ The user doesn't exist in your Airtable Users table yet

## 🔧 Setting Up Your First User

You have two options to create users:

### Option 1: Create User via API (Recommended)

The system includes a user creation endpoint. Use this to create your first admin user:

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "name": "Admin User",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

**Using Postman or similar:**
- URL: `http://localhost:3000/api/auth/create-user`
- Method: POST
- Body (JSON):
  ```json
  {
    "email": "admin@example.com",
    "name": "Admin User",
    "password": "your-secure-password",
    "role": "admin"
  }
  ```

### Option 2: Create User Directly in Airtable

1. Go to your Airtable base
2. Open the "Users" table
3. Create a new record with these fields:

| Field | Value | Notes |
|-------|-------|-------|
| **Email** | admin@example.com | Your email |
| **Name** | Admin User | Display name |
| **PasswordHash** | (see below) | Hashed password |
| **Role** | admin | admin/staff/user |
| **IsActive** | ✓ (checked) | Enable the account |

**To generate PasswordHash:**

You need to hash your password with bcrypt. Use this Node.js script:

```javascript
// hash-password.js
const bcrypt = require('bcryptjs');
const password = 'your-secure-password';
bcrypt.hash(password, 12).then(hash => console.log(hash));
```

Run:
```bash
cd packages/client
node hash-password.js
```

Copy the output and paste it into the PasswordHash field in Airtable.

## 📋 Airtable Users Table Structure

Make sure your Airtable "Users" table has these fields:

| Field Name | Type | Required | Notes |
|------------|------|----------|-------|
| **Email** | Single line text | Yes | User's email (must be unique) |
| **Name** | Single line text | Yes | User's display name |
| **PasswordHash** | Long text | Yes | bcrypt hashed password |
| **Role** | Single select | Yes | Options: admin, staff, user |
| **IsActive** | Checkbox | No | Defaults to true if not specified |

## 🔐 User Roles

**admin:**
- Full access to all features
- Can access /admin routes
- Can manage users

**staff:**
- Access to staff-only features
- Can access dashboards and data
- Limited admin capabilities

**user:**
- Basic access
- Can view own data
- Limited features

## 🧪 Testing Authentication

### 1. Create a Test User

Use Option 1 above to create a user:
```bash
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "test123",
    "role": "user"
  }'
```

### 2. Try Logging In

1. Visit http://localhost:3000/auth/signin
2. Enter:
   - Email: test@example.com
   - Password: test123
3. Click Sign In

### 3. Expected Behavior

**Success:**
- Redirected to dashboard
- User session created
- Name appears in navigation

**Failure:**
- "Invalid credentials" - Wrong email or password
- "Account deactivated" - IsActive is unchecked
- "User not found" - User doesn't exist in Airtable

## 🔍 Troubleshooting

### "Could not find what you are looking for"

**Cause:** User doesn't exist in Airtable Users table

**Fix:**
1. Check Airtable Users table exists
2. Check table name matches `AIRTABLE_USERS_TABLE` env var
3. Create a user using Option 1 or 2 above

### "AUTHENTICATION_ERROR" or "INVALID_API_KEY"

**Cause:** Airtable credentials are wrong or missing

**Fix:**
1. Check `packages/client/.env.local` has:
   ```env
   AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token_here
   AIRTABLE_BASE_ID=your_base_id_here
   ```
2. Verify token has read/write access to the base
3. Restart the dev server after changing env

### "Invalid credentials" with Correct Password

**Cause:** Password hash doesn't match

**Fix:**
1. Delete the user record in Airtable
2. Recreate using the API endpoint (Option 1)
3. This ensures proper bcrypt hashing

### Login Page Won't Load

**Cause:** NextAuth routes not properly configured

**Fix:**
1. Check `packages/client/app/api/auth/[...nextauth]/route.ts` exists
2. Check `packages/client/lib/auth.ts` exists
3. Restart dev server: `bun run dev:client`

## 📊 Checking Auth Status

### View Server Logs

The server logs show auth attempts:
```
[0] Authentication error: Error: Invalid credentials
```

This is **normal** for failed login attempts. Successful logins show:
```
[0] User authenticated: test@example.com
```

### Check Session

In browser console:
```javascript
// Get session
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log);
```

Logged in:
```json
{
  "user": {
    "email": "test@example.com",
    "name": "Test User",
    "role": "user"
  },
  "expires": "..."
}
```

Not logged in:
```json
{}
```

## 🔒 Security Notes

### Password Requirements

Currently no enforced requirements, but recommend:
- Minimum 8 characters
- Mix of letters, numbers, symbols
- Not a common password

### Password Hashing

- Uses bcrypt with salt rounds = 12
- Passwords are **never** stored in plain text
- Hashes are one-way (cannot be reversed)

### Session Security

- JWT-based sessions
- Secure cookies (httpOnly)
- Session expires after period of inactivity
- Secret key should be strong and random

## ✅ Quick Setup Checklist

- [ ] Airtable Users table exists with correct fields
- [ ] Environment variables set in `packages/client/.env.local`
- [ ] Dev server running: `bun run dev:client`
- [ ] Created first user (admin) via API
- [ ] Tested login at http://localhost:3000/auth/signin
- [ ] Successfully authenticated and redirected

## 🎯 Next Steps

Once you have authentication working:

1. **Create multiple test users** with different roles
2. **Test role-based access** to different pages
3. **Set up your actual users** in Airtable
4. **Continue API migration** following [NEXT_STEPS.md](./NEXT_STEPS.md)

## 📚 Related Documentation

- [NEXT_STEPS.md](./NEXT_STEPS.md) - Continue development
- [SUCCESS.md](./SUCCESS.md) - What's working
- [FIXES.md](./FIXES.md) - Issues resolved

---

**Need Help?**

The error you're seeing is **expected** when no user exists. Follow Option 1 above to create your first user and try logging in again!
