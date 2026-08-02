'use client';

import { useEffect } from 'react';

/**
 * Attaches the Better Auth session cookie to requests this app makes straight
 * to the Hono API.
 *
 * The API now authenticates every request (packages/server/src/middleware/
 * require-auth.ts). Calls that go through a Next.js proxy route under app/api/
 * authenticate with a shared secret server-side, but this app also calls the
 * API directly from the browser in ~86 places via NEXT_PUBLIC_API_URL, and
 * those must send the user's session cookie instead. Cross-origin `fetch` omits
 * cookies unless `credentials: 'include'` is set.
 *
 * Doing that here, once, rather than editing every call site keeps the change
 * small and means a newly added `fetch` cannot silently miss it. The wrapper is
 * deliberately narrow: it only touches requests aimed at the API origin and
 * only when the caller hasn't already chosen a credentials mode. Everything
 * else — Next.js routes, third-party URLs, RSC payloads — passes straight
 * through.
 *
 * Individual call sites can migrate to `apiCall` in lib/api.ts (which already
 * sets credentials) over time; this stays correct either way.
 */
export default function ApiCredentialsProvider() {
  useEffect(() => {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL;
    if (!apiOrigin || typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    // Guard against double-wrapping across Fast Refresh / remounts.
    if ((originalFetch as { __apiCredentialsWrapped?: boolean }).__apiCredentialsWrapped) {
      return;
    }

    const targetsApi = (input: RequestInfo | URL): boolean => {
      try {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        // Only absolute URLs can point at the API's origin; relative ones are
        // same-origin Next.js routes and already send cookies.
        return url.startsWith(apiOrigin);
      } catch {
        return false;
      }
    };

    // Object.assign carries over the extra properties Next/React hang off
    // fetch (fetch.preconnect), which a bare arrow function would drop.
    const wrapped = Object.assign(
      function wrappedFetch(input: RequestInfo | URL, init?: RequestInit) {
        if (targetsApi(input) && init?.credentials === undefined) {
          return originalFetch(input, { ...init, credentials: 'include' });
        }
        return originalFetch(input, init);
      },
      originalFetch,
      { __apiCredentialsWrapped: true }
    ) as typeof window.fetch;

    window.fetch = wrapped;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
