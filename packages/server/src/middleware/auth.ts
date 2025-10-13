/**
 * Authentication Middleware
 */

import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'default-secret-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Middleware to verify JWT token and attach user to context
 */
export async function authMiddleware(c: Context, next: Next) {
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

    // Attach user to context
    c.set('user', {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role
    } as AuthUser);

    await next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json(
      { success: false, error: 'Invalid or expired token' },
      401
    );
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthUser;

    if (!user) {
      return c.json(
        { success: false, error: 'Authentication required' },
        401
      );
    }

    if (!roles.includes(user.role)) {
      return c.json(
        { success: false, error: 'Insufficient permissions' },
        403
      );
    }

    await next();
  };
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user is staff or admin
 */
export const requireStaff = requireRole('admin', 'staff');
