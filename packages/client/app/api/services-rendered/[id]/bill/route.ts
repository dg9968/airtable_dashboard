import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = getHonoApiUrl(`/api/services-rendered/${params.id}/bill`);

  try {
    const body = await request.json();
    console.log('[Next.js Proxy] POST /api/services-rendered/:id/bill');
    console.log('[Next.js Proxy] Service ID:', params.id);
    console.log('[Next.js Proxy] Request body:', body);
    console.log('[Next.js Proxy] Proxying to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Next.js Proxy] Response status:', response.status);
    console.log('[Next.js Proxy] Response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Next.js Proxy] Error proxying to Hono API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to API server', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
