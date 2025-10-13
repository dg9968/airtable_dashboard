#!/usr/bin/env bun
/**
 * Debug Authentication Script
 *
 * Helps troubleshoot authentication issues
 */

import Airtable from 'airtable';

// Load environment from client package
const envPath = './packages/client/.env.local';
const envFile = await Bun.file(envPath).text().catch(() => '');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

console.log('🔍 Authentication Debug\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   AIRTABLE_PERSONAL_ACCESS_TOKEN: ${env.AIRTABLE_PERSONAL_ACCESS_TOKEN ? '✓ Set' : '✗ Missing'}`);
console.log(`   AIRTABLE_BASE_ID: ${env.AIRTABLE_BASE_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`   AIRTABLE_USERS_TABLE: ${env.AIRTABLE_USERS_TABLE || 'Users (default)'}`);
console.log('');

if (!env.AIRTABLE_PERSONAL_ACCESS_TOKEN || !env.AIRTABLE_BASE_ID) {
  console.log('❌ Missing required environment variables in packages/client/.env.local');
  console.log('   Please set:');
  console.log('   - AIRTABLE_PERSONAL_ACCESS_TOKEN');
  console.log('   - AIRTABLE_BASE_ID');
  console.log('   - AIRTABLE_USERS_TABLE (optional, defaults to "Users")');
  process.exit(1);
}

const USERS_TABLE = env.AIRTABLE_USERS_TABLE || 'Users';

// Initialize Airtable
const airtable = new Airtable({
  apiKey: env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});
const base = airtable.base(env.AIRTABLE_BASE_ID);

// Test connection
console.log('🔌 Testing Airtable Connection...');
try {
  const records = await base(USERS_TABLE).select({ maxRecords: 1 }).firstPage();
  console.log('✅ Connection successful!');
  console.log(`   Table "${USERS_TABLE}" is accessible`);
  console.log('');
} catch (error) {
  console.log('❌ Connection failed!');
  console.error(error);
  process.exit(1);
}

// Test user lookup with email
const email = process.argv[2];
if (!email) {
  console.log('💡 Usage: bun run scripts/debug-auth.ts <email>');
  console.log('   Example: bun run scripts/debug-auth.ts daniel@vault1040.com');
  process.exit(0);
}

console.log(`🔍 Looking up user: ${email}\n`);

try {
  // Show the exact formula being used
  const formula = `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`;
  console.log(`📝 Query formula: ${formula}\n`);

  const records = await base(USERS_TABLE)
    .select({
      filterByFormula: formula
    })
    .firstPage();

  if (records.length === 0) {
    console.log('❌ User not found with this query');
    console.log('\n💡 Debugging tips:');
    console.log('   1. Check the email is exactly correct (case-insensitive)');
    console.log('   2. Check the field name in Airtable is exactly "Email"');
    console.log('   3. Check the user has an Email field filled in');
    console.log('   4. Try listing all users: bun run scripts/manage-users.ts list');
    console.log('');

    // Try to list all users to compare
    console.log('📋 All users in table:');
    const allRecords = await base(USERS_TABLE).select().firstPage();
    allRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.fields.Name || 'No Name'} - ${record.fields.Email || 'No Email'}`);
    });

    process.exit(1);
  }

  const record = records[0];
  const fields = record.fields;

  console.log('✅ User found!');
  console.log(`   Name: ${fields.Name}`);
  console.log(`   Email: ${fields.Email}`);
  console.log(`   Role: ${fields.Role || 'user'}`);
  console.log(`   Active: ${fields.IsActive !== false ? 'Yes' : 'No'}`);
  console.log(`   Has PasswordHash: ${fields.PasswordHash ? 'Yes ✓' : 'No ✗'}`);
  console.log(`   ID: ${record.id}`);
  console.log('');

  if (!fields.PasswordHash) {
    console.log('⚠️  WARNING: User has no password hash!');
    console.log('   This user cannot log in until a password is set.');
    console.log('   Use: bun run scripts/manage-users.ts delete <email>');
    console.log('   Then: bun run scripts/manage-users.ts create <email> <name> <password> <role>');
  } else {
    console.log('✅ User should be able to log in!');
    console.log('');
    console.log('🧪 Test login at: http://localhost:3000/auth/signin');
  }

} catch (error) {
  console.log('❌ Error querying user:');
  console.error(error);
  process.exit(1);
}
