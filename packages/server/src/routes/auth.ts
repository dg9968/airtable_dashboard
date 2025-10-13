/**
 * Authentication Routes
 */

import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { compare, hash } from 'bcryptjs';
import Airtable from 'airtable';

const app = new Hono();

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
});

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '');
const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production';

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
}

async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const records = await base(USERS_TABLE)
      .select({
        filterByFormula: `LOWER({Email}) = LOWER('${email.replace(/'/g, "\\'")}')`
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const fields = record.fields;

    return {
      id: record.id,
      email: fields.Email as string,
      name: fields.Name as string,
      passwordHash: fields.PasswordHash as string,
      role: fields.Role as string || 'user',
      isActive: fields.IsActive !== false
    };
  } catch (error) {
    console.error('Error fetching user from Airtable:', error);
    return null;
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json(
        { success: false, error: 'Please enter email and password' },
        400
      );
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return c.json(
        { success: false, error: 'Invalid credentials' },
        401
      );
    }

    if (!user.isActive) {
      return c.json(
        { success: false, error: 'Account is deactivated. Contact administrator.' },
        403
      );
    }

    const isValidPassword = await compare(password, user.passwordHash);

    if (!isValidPassword) {
      return c.json(
        { success: false, error: 'Invalid credentials' },
        401
      );
    }

    // Generate JWT token
    const token = await sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
      },
      JWT_SECRET
    );

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return c.json(
      { success: false, error: 'Authentication failed' },
      500
    );
  }
});

/**
 * GET /api/auth/me
 * Get current user from JWT token
 */
app.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        { success: false, error: 'No token provided' },
        401
      );
    }

    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_SECRET);

    return c.json({
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return c.json(
      { success: false, error: 'Invalid or expired token' },
      401
    );
  }
});

/**
 * POST /api/auth/register
 * Create a new user (admin only)
 */
app.post('/register', async (c) => {
  try {
    // TODO: Add admin authentication middleware
    const { email, name, password, role = 'user' } = await c.req.json();

    if (!email || !name || !password) {
      return c.json(
        { success: false, error: 'Email, name, and password are required' },
        400
      );
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return c.json(
        { success: false, error: 'User with this email already exists' },
        409
      );
    }

    const passwordHash = await hash(password, 12);

    const record = await base(USERS_TABLE).create([
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

    return c.json({
      success: true,
      userId: record[0].id
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user'
      },
      500
    );
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
app.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        { success: false, error: 'No token provided' },
        401
      );
    }

    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_SECRET);

    // Generate new token
    const newToken = await sign(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
      },
      JWT_SECRET
    );

    return c.json({
      success: true,
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json(
      { success: false, error: 'Invalid or expired token' },
      401
    );
  }
});

export default app;
