import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

function buildUrl(request: NextRequest, pathArray?: string[]): string {
  const path = pathArray ? pathArray.join('/') : '';
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const base = getHonoApiUrl(`/api/companies${path ? `/${path}` : ''}`);
  return query ? `${base}?${query}` : base;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = buildUrl(request, path);

  try {
    const response = await fetch(url, { method: 'GET', headers: getApiHeaders() });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to Hono API:', error);
    return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = buildUrl(request, path);
  const body = await request.json();

  try {
    const response = await fetch(url, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(body) });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to Hono API:', error);
    return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = buildUrl(request, path);
  const body = await request.json();

  try {
    const response = await fetch(url, { method: 'PATCH', headers: getApiHeaders(), body: JSON.stringify(body) });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to Hono API:', error);
    return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = buildUrl(request, path);

  try {
    const response = await fetch(url, { method: 'DELETE', headers: getApiHeaders() });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to Hono API:', error);
    return NextResponse.json({ success: false, error: 'Failed to connect to API server' }, { status: 500 });
  }
}
