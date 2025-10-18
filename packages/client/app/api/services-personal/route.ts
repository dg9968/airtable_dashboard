import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const url = getHonoApiUrl(`/api/services-personal${searchParams ? '?' + searchParams : ''}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to Hono API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to API server' },
      { status: 500 }
    );
  }
}
