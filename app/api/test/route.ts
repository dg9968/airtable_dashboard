// app/api/test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Test API route called');
    
    // Check environment variables
    const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    
    console.log('Environment check:', {
      hasToken: !!token,
      hasBaseId: !!baseId,
      tokenLength: token?.length || 0,
      baseIdLength: baseId?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: 'Test API is working',
      environment: {
        hasToken: !!token,
        hasBaseId: !!baseId,
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Test API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}