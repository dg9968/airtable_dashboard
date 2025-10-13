#!/usr/bin/env bun
/**
 * User Management Script
 *
 * Usage:
 *   bun run scripts/manage-users.ts list              # List all users
 *   bun run scripts/manage-users.ts create             # Create a new user (interactive)
 *   bun run scripts/manage-users.ts find <email>       # Find user by email
 *   bun run scripts/manage-users.ts delete <email>     # Delete user by email
 *   bun run scripts/manage-users.ts activate <email>   # Activate user
 *   bun run scripts/manage-users.ts deactivate <email> # Deactivate user
 */

import Airtable from 'airtable';
import { hash } from 'bcryptjs';

// Load environment from server package
const envPath = './packages/server/.env';
const envFile = await Bun.file(envPath).text().catch(() => '');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const AIRTABLE_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE_ID;
const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || env.AIRTABLE_USERS_TABLE || 'Users';

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
  console.error('❌ Error: Missing Airtable credentials');
  console.error('Make sure AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID are set');
  console.error('in packages/server/.env or as environment variables');
  process.exit(1);
}

const airtable = new Airtable({ apiKey: AIRTABLE_TOKEN });
const base = airtable.base(AIRTABLE_BASE_ID);

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

// List all users
async function listUsers() {
  console.log('\n📋 Listing all users...\n');

  try {
    const records = await base(USERS_TABLE).select().all();

    if (records.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${records.length} user(s):\n`);

    records.forEach((record, index) => {
      const fields = record.fields;
      console.log(`${index + 1}. ${fields.Name || 'No Name'}`);
      console.log(`   Email:  ${fields.Email || 'No Email'}`);
      console.log(`   Role:   ${fields.Role || 'user'}`);
      console.log(`   Active: ${fields.IsActive !== false ? '✓' : '✗'}`);
      console.log(`   ID:     ${record.id}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error listing users:', error);
  }
}

// Find user by email
async function findUser(email: string) {
  console.log(`\n🔍 Searching for user: ${email}...\n`);

  try {
    const records = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    console.log('✅ User found:');
    console.log(`   Name:   ${fields.Name}`);
    console.log(`   Email:  ${fields.Email}`);
    console.log(`   Role:   ${fields.Role || 'user'}`);
    console.log(`   Active: ${fields.IsActive !== false ? 'Yes ✓' : 'No ✗'}`);
    console.log(`   ID:     ${record.id}`);
    console.log('');

    return { id: record.id, ...fields };
  } catch (error) {
    console.error('❌ Error finding user:', error);
    return null;
  }
}

// Create new user
async function createUser(email: string, name: string, password: string, role: string = 'user') {
  console.log(`\n➕ Creating user: ${email}...\n`);

  try {
    // Check if user already exists
    const existing = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage();

    if (existing.length > 0) {
      console.log(`❌ User already exists: ${email}`);
      return false;
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const records = await base(USERS_TABLE).create([
      {
        fields: {
          Email: email,
          Name: name,
          PasswordHash: passwordHash,
          Role: role,
          IsActive: true
        }
      }
    ]);

    console.log('✅ User created successfully!');
    console.log(`   Name:  ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role:  ${role}`);
    console.log(`   ID:    ${records[0].id}`);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    return false;
  }
}

// Delete user
async function deleteUser(email: string) {
  console.log(`\n🗑️  Deleting user: ${email}...\n`);

  try {
    const records = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return false;
    }

    await base(USERS_TABLE).destroy([records[0].id]);

    console.log('✅ User deleted successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return false;
  }
}

// Activate/Deactivate user
async function setUserActive(email: string, active: boolean) {
  const action = active ? 'Activating' : 'Deactivating';
  console.log(`\n🔧 ${action} user: ${email}...\n`);

  try {
    const records = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return false;
    }

    await base(USERS_TABLE).update([
      {
        id: records[0].id,
        fields: {
          IsActive: active
        }
      }
    ]);

    console.log(`✅ User ${active ? 'activated' : 'deactivated'} successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Error ${action.toLowerCase()} user:`, error);
    return false;
  }
}

// Interactive create user
async function interactiveCreate() {
  console.log('\n🆕 Create New User\n');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q: string): Promise<string> =>
    new Promise(resolve => readline.question(q, resolve));

  try {
    const email = await question('Email: ');
    const name = await question('Name: ');
    const password = await question('Password: ');
    const role = await question('Role (admin/staff/user) [user]: ') || 'user';

    readline.close();

    if (!email || !name || !password) {
      console.log('\n❌ Email, name, and password are required!');
      return;
    }

    await createUser(email, name, password, role);
  } catch (error) {
    readline.close();
    console.error('❌ Error:', error);
  }
}

// Main CLI handler
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    await listUsers();
    break;

  case 'find':
    if (!args[1]) {
      console.log('❌ Usage: bun run scripts/manage-users.ts find <email>');
      process.exit(1);
    }
    await findUser(args[1]);
    break;

  case 'create':
    if (args.length === 1) {
      // Interactive mode
      await interactiveCreate();
    } else if (args.length >= 4) {
      // Command line mode
      const [, email, name, password, role = 'user'] = args;
      await createUser(email, name, password, role);
    } else {
      console.log('❌ Usage:');
      console.log('   Interactive: bun run scripts/manage-users.ts create');
      console.log('   Direct:      bun run scripts/manage-users.ts create <email> <name> <password> [role]');
      process.exit(1);
    }
    break;

  case 'delete':
    if (!args[1]) {
      console.log('❌ Usage: bun run scripts/manage-users.ts delete <email>');
      process.exit(1);
    }
    await deleteUser(args[1]);
    break;

  case 'activate':
    if (!args[1]) {
      console.log('❌ Usage: bun run scripts/manage-users.ts activate <email>');
      process.exit(1);
    }
    await setUserActive(args[1], true);
    break;

  case 'deactivate':
    if (!args[1]) {
      console.log('❌ Usage: bun run scripts/manage-users.ts deactivate <email>');
      process.exit(1);
    }
    await setUserActive(args[1], false);
    break;

  default:
    console.log(`
📚 User Management Script

Usage:
  bun run scripts/manage-users.ts <command> [options]

Commands:
  list                        List all users
  find <email>                Find user by email
  create                      Create user (interactive)
  create <email> <name> <pw> [role]  Create user (direct)
  delete <email>              Delete user
  activate <email>            Activate user
  deactivate <email>          Deactivate user

Examples:
  bun run scripts/manage-users.ts list
  bun run scripts/manage-users.ts find admin@example.com
  bun run scripts/manage-users.ts create
  bun run scripts/manage-users.ts create admin@test.com "Admin" "pass123" admin
  bun run scripts/manage-users.ts delete test@example.com
  bun run scripts/manage-users.ts activate user@example.com

Environment:
  Reads from packages/server/.env or environment variables
  - AIRTABLE_PERSONAL_ACCESS_TOKEN
  - AIRTABLE_BASE_ID
  - AIRTABLE_USERS_TABLE (default: Users)
`);
    process.exit(0);
}
