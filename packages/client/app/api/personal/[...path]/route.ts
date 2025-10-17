import { NextRequest, NextResponse } from 'next/server';

const HONO_API_URL = process.env.HONO_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join('/') || '';
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${HONO_API_URL}/api/personal${path ? '/' + path : ''}${searchParams ? '?' + searchParams : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join('/') || '';
  const url = `${HONO_API_URL}/api/personal${path ? '/' + path : ''}`;

  try {
    const body = await request.json();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join('/') || '';
  const url = `${HONO_API_URL}/api/personal${path ? '/' + path : ''}`;

  try {
    const body = await request.json();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
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
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join('/') || '';
  const url = `${HONO_API_URL}/api/personal${path ? '/' + path : ''}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
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
