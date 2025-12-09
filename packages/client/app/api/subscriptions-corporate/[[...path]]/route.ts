import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  const searchParams = request.nextUrl.searchParams.toString();
  const url = getHonoApiUrl(`/api/subscriptions-corporate${path ? '/' + path : ''}${searchParams ? '?' + searchParams : ''}`);

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  const url = getHonoApiUrl(`/api/subscriptions-corporate${path ? '/' + path : ''}`);

  try {
    const body = await request.json();
    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify(body),
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  const url = getHonoApiUrl(`/api/subscriptions-corporate${path ? '/' + path : ''}`);

  try {
    const body = await request.json();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getApiHeaders(),
      body: JSON.stringify(body),
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathArray } = await params;
  const path = pathArray?.join('/') || '';
  const url = getHonoApiUrl(`/api/subscriptions-corporate${path ? '/' + path : ''}`);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
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
