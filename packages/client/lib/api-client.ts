/**
 * API Client Helper for Hono Server
 * Handles authentication and request forwarding
 */

const HONO_API_URL = process.env.HONO_API_URL || 'http://localhost:3001';
const API_SECRET_KEY = process.env.API_SECRET_KEY;

export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (API_SECRET_KEY) {
    headers['X-API-Key'] = API_SECRET_KEY;
  }

  return headers;
}

export function getHonoApiUrl(path: string): string {
  return `${HONO_API_URL}${path}`;
}
