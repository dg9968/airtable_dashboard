import { NextRequest, NextResponse } from 'next/server';
import { getApiHeaders, getHonoApiUrl } from '@/lib/api-client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = getHonoApiUrl(`/api/services-rendered/${id}/status`);

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
    console.error('Error proxying PATCH /api/services-rendered/:id/status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to API server' },
      { status: 500 }
    );
  }
}
