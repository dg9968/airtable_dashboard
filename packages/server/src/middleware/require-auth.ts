/**
 * Authentication for the Hono API.
 *
 * This server holds SSNs, EINs, bank statements and client documents, and
 * until this middleware existed every route was reachable by anyone who knew
 * the URL. Two kinds of caller legitimately reach it, so two credentials are
 * accepted:
 *
 *   1. X-API-Key — the Next.js proxy routes under packages/client/app/api/
 *      call this server from their own server side and already send this
 *      header via getApiHeaders() (packages/client/lib/api-client.ts). It
 *      just was never checked here.
 *
 *   2. Better Auth session cookie — the browser also calls this server
 *      directly in ~86 places via NEXT_PUBLIC_API_URL, bypassing those
 *      proxies. Those requests can't carry a shared secret (it would ship in
 *      the browser bundle), so they authenticate with the session cookie the
 *      user already has. That requires the cookie to actually reach us: see
 *      crossSubDomainCookies in packages/client/lib/auth.ts, which needs the
 *      API served from a subdomain of the same registrable domain as the app
 *      (api.vault1040.com / app.vault1040.com). In local dev this is free —
 *      cookies ignore port, so a localhost:3000 cookie is sent to :3001.
 *
 * The cookie value is signed by Better Auth as
 * `encodeURIComponent(token + "." + base64Hmac)`, so the raw session token is
 * everything left of the first "." after URL-decoding. We do not verify the
 * HMAC: the token is itself the bearer secret and the database lookup is
 * authoritative, so a forged signature over an unknown token still fails. That
 * also keeps BETTER_AUTH_SECRET off this server.
 *
 * Rollout: set API_AUTH_MODE=report to log what *would* have been rejected
 * without actually rejecting it. Deploy that way once, confirm the log is
 * quiet, then drop the variable to enforce.
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { authSession, authUser } from '../db/auth-readonly';

// Better Auth picks the cookie name by whether the connection is secure —
// same pair packages/client/middleware.ts already checks for.
const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

// Paths that must stay reachable without a credential.
const PUBLIC_PATHS = [
  '/health',
  // n8n posts delivery/status callbacks here from outside the app, so it has
  // no session and no API key. It needs its own shared secret — until then,
  // leaving it open preserves existing behaviour rather than silently
  // breaking communications.
  '/api/communications-webhook',
];

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Extracts the raw session token from Better Auth's signed cookie value. */
export function parseSessionToken(rawCookie: string): string | null {
  if (!rawCookie) return null;
  let value = rawCookie;
  try {
    value = decodeURIComponent(rawCookie);
  } catch {
    // Malformed percent-encoding — fall through and try the raw value, since
    // an unencoded token is still a valid lookup key.
  }
  const dot = value.indexOf('.');
  const token = dot === -1 ? value : value.slice(0, dot);
  return token || null;
}

async function resolveSessionUser(c: Context): Promise<AuthedUser | null> {
  let raw: string | undefined;
  for (const name of SESSION_COOKIE_NAMES) {
    raw = getCookie(c, name);
    if (raw) break;
  }
  if (!raw) return null;

  const token = parseSessionToken(raw);
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role,
    })
    .from(authSession)
    .innerJoin(authUser, eq(authUser.id, authSession.userId))
    .where(and(eq(authSession.token, token), gt(authSession.expiresAt, new Date())))
    .limit(1);

  return row ?? null;
}

export function requireAuth() {
  // Without this, every Next.js proxy route 401s: those call us from their own
  // server side, so they carry no browser cookie and the API key is their only
  // credential. Fail loudly at startup rather than as scattered 401s.
  if (!process.env.API_SECRET_KEY) {
    console.warn(
      '[require-auth] API_SECRET_KEY is not set — requests from the Next.js ' +
        'proxy routes cannot authenticate and will be rejected. Set the same ' +
        'value in packages/server/.env and packages/client/.env.local.'
    );
  }

  return async (c: Context, next: Next) => {
    if (isPublicPath(c.req.path)) return next();

    // Preflight carries no credentials by design; the cors() middleware
    // registered before this one answers it.
    if (c.req.method === 'OPTIONS') return next();

    const apiKey = process.env.API_SECRET_KEY;
    if (apiKey && c.req.header('X-API-Key') === apiKey) {
      return next();
    }

    let user: AuthedUser | null = null;
    try {
      user = await resolveSessionUser(c);
    } catch (error) {
      console.error('[require-auth] session lookup failed:', error);
    }

    if (user) {
      c.set('user', user);
      return next();
    }

    if (process.env.API_AUTH_MODE === 'report') {
      console.warn(
        `[require-auth] REPORT-ONLY: would reject ${c.req.method} ${c.req.path} ` +
          `(origin=${c.req.header('origin') ?? 'none'}, hasCookie=${Boolean(
            SESSION_COOKIE_NAMES.some((n) => getCookie(c, n))
          )}, hasApiKey=${Boolean(c.req.header('X-API-Key'))})`
      );
      return next();
    }

    return c.json({ success: false, error: 'Unauthorized' }, 401);
  };
}
