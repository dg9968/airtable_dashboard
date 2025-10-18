/**
 * API Client Helper for Hono Server
 * Handles authentication and request forwarding
 */

export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured (read at runtime for server-side routes)
  const apiKey = process.env.API_SECRET_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return headers;
}

export function getHonoApiUrl(path: string): string {
  const honoApiUrl = process.env.HONO_API_URL || 'http://localhost:3001';
  return `${honoApiUrl}${path}`;
}
