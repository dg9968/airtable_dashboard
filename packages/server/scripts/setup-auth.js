#!/usr/bin/env node

// scripts/setup-auth.js - Script to set up initial admin user
// Run with: node scripts/setup-auth.js

require('dotenv').config({ path: '.env.local' })
const Airtable = require('airtable')
const bcrypt = require('bcryptjs')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve)
  })
}

async function setupAuth() {
  console.log('🔐 Airtable Authentication Setup')
  console.log('================================\n')

  // Check environment variables
  if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    console.error('❌ Missing AIRTABLE_PERSONAL_ACCESS_TOKEN in .env.local')
    process.exit(1)
  }

  if (!process.env.AIRTABLE_BASE_ID) {
    console.error('❌ Missing AIRTABLE_BASE_ID in .env.local')
    process.exit(1)
  }

  const airtable = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
  })
  const base = airtable.base(process.env.AIRTABLE_BASE_ID)
  const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users'

  try {
    console.log('📋 First, you need to create a "Users" table in your Airtable base with these fields:')
    console.log('   - Email (Single line text, required)')
    console.log('   - Name (Single line text, required)')
    console.log('   - PasswordHash (Long text, required)')
    console.log('   - Role (Single select: admin, user, staff)')
    console.log('   - IsActive (Checkbox, defaults to checked)')
    console.log('')

    const confirm = await question('Have you created the Users table with these fields? (y/n): ')
    if (confirm.toLowerCase() !== 'y') {
      console.log('Please create the Users table first, then run this script again.')
      rl.close()
      return
    }

    // Get admin user details
    console.log('\n👤 Creating initial admin user:')
    const email = await question('Admin email: ')
    const name = await question('Admin name: ')
    const password = await question('Admin password: ')

    // Validate inputs
    if (!email || !name || !password) {
      console.error('❌ All fields are required')
      rl.close()
      return
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters')
      rl.close()
      return
    }

    // Hash password
    console.log('\n🔒 Hashing password...')
    const passwordHash = await bcrypt.hash(password, 12)

    // Check if user already exists
    console.log('🔍 Checking if user already exists...')
    const existingUsers = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage()

    if (existingUsers.length > 0) {
      console.log('⚠️  User already exists. Updating...')
      await base(USERS_TABLE).update(existingUsers[0].id, {
        Name: name,
        PasswordHash: passwordHash,
        Role: 'admin',
        IsActive: true
      })
      console.log('✅ Admin user updated successfully!')
    } else {
      console.log('➕ Creating new admin user...')
      await base(USERS_TABLE).create([
        {
          fields: {
            Email: email,
            Name: name,
            PasswordHash: passwordHash,
            Role: 'admin',
            IsActive: true
          }
        }
      ])
      console.log('✅ Admin user created successfully!')
    }

    console.log('\n🎉 Authentication setup complete!')
    console.log('📝 Remember to set NEXTAUTH_SECRET in your .env.local file')
    console.log('🚀 You can now sign in with your admin credentials')

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    if (error.message.includes('NOT_FOUND')) {
      console.log('💡 Make sure the Users table exists in your Airtable base')
    }
  }

  rl.close()
}

setupAuth()