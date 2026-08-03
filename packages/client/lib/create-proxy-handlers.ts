import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

type RouteContext = { params: Promise<{ path?: string[] }> };

/**
 * Builds the Hono URL for an incoming proxied request, forwarding both the
 * sub-path and the query string.
 *
 * Written for an optional catch-all segment (`[[...path]]`), so `pathArray` is
 * undefined on the base route — hence the conditional join rather than an
 * unguarded template, which would emit a trailing slash for the bare path.
 */
async function resolveUrl(apiRoute: string, request: NextRequest, params: RouteContext['params']) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  const query = new URL(request.url).searchParams.toString();
  const base = getHonoApiUrl(`${apiRoute}${path ? '/' + path : ''}`);
  return query ? `${base}?${query}` : base;
}

async function proxy(
  apiRoute: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  request: NextRequest,
  params: RouteContext['params']
) {
  const url = await resolveUrl(apiRoute, request, params);
  try {
    const response = await fetch(url, {
      method,
      headers: getApiHeaders(),
      // Only read a body for the methods that carry one — GET/DELETE requests
      // here never do, and request.json() would throw on an empty body.
      ...(method === 'POST' || method === 'PATCH'
        ? { body: JSON.stringify(await request.json()) }
        : {}),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error(`Error proxying ${method} ${apiRoute} to Hono API:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to API server' },
      { status: 500 }
    );
  }
}

/**
 * All four proxy handlers for one Hono route, so a Next.js proxy route file is
 * a single line. Exporting the whole set is the point: a hand-rolled proxy that
 * simply omitted `POST` made /api/subscriptions-corporate/bulk-assign answer
 * 405 with an empty body, which then surfaced in the caller as
 * "Unexpected end of JSON input". Deriving every method from one definition
 * makes that failure mode unrepresentable.
 *
 * Use from an optional catch-all route (`[[...path]]/route.ts`) so one file
 * serves both the base path and its sub-paths:
 *
 *   export const { GET, POST, PATCH, DELETE } = createProxyHandlers('/api/thing');
 */
export function createProxyHandlers(apiRoute: string) {
  return {
    GET: (request: NextRequest, { params }: RouteContext) => proxy(apiRoute, 'GET', request, params),
    POST: (request: NextRequest, { params }: RouteContext) => proxy(apiRoute, 'POST', request, params),
    PATCH: (request: NextRequest, { params }: RouteContext) =>
      proxy(apiRoute, 'PATCH', request, params),
    DELETE: (request: NextRequest, { params }: RouteContext) =>
      proxy(apiRoute, 'DELETE', request, params),
  };
}
