import { NextRequest, NextResponse } from 'next/server';

const HONO_API_URL = process.env.HONO_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const url = `${HONO_API_URL}/api/processor-billing`;

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
