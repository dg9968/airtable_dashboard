import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

type RouteContext = { params: Promise<{ path?: string[] }> };

async function resolveUrl(apiRoute: string, params: RouteContext['params']) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  return getHonoApiUrl(`${apiRoute}${path ? '/' + path : ''}`);
}

export function createProxyHandlers(apiRoute: string) {
  return {
    async GET(_req: NextRequest, { params }: RouteContext) {
      const url = await resolveUrl(apiRoute, params);
      try {
        const response = await fetch(url, { method: 'GET', headers: getApiHeaders() });
        return NextResponse.json(await response.json(), { status: response.status });
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
      }
    },

    async POST(request: NextRequest, { params }: RouteContext) {
      const url = await resolveUrl(apiRoute, params);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify(await request.json()),
        });
        return NextResponse.json(await response.json(), { status: response.status });
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
      }
    },

    async PATCH(request: NextRequest, { params }: RouteContext) {
      const url = await resolveUrl(apiRoute, params);
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: getApiHeaders(),
          body: JSON.stringify(await request.json()),
        });
        return NextResponse.json(await response.json(), { status: response.status });
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
      }
    },

    async DELETE(_req: NextRequest, { params }: RouteContext) {
      const url = await resolveUrl(apiRoute, params);
      try {
        const response = await fetch(url, { method: 'DELETE', headers: getApiHeaders() });
        return NextResponse.json(await response.json(), { status: response.status });
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
      }
    },
  };
}
