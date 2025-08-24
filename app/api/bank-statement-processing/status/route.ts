import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const fileKey = searchParams.get('fileKey')

    if (!fileKey) {
      return NextResponse.json({ error: 'File key is required' }, { status: 400 })
    }

    // TODO: Replace with actual AWS S3 SDK implementation
    // In a real implementation, you would:
    // 1. Check S3 parsed directory for the processed file
    // 2. Query AWS Lambda function status
    // 3. Return actual processing status
    
    // Simulate processing time and status
    const uploadTime = extractTimestampFromFileKey(fileKey)
    const currentTime = Date.now()
    const elapsedTime = currentTime - uploadTime
    
    // Simulate different processing stages
    let status: string
    let processed = false
    let qboUrl: string | null = null
    let error: string | null = null

    if (elapsedTime < 5000) {
      status = 'Processing bank statement...'
    } else if (elapsedTime < 10000) {
      status = 'Extracting transaction data...'
    } else if (elapsedTime < 15000) {
      status = 'Converting to QBO format...'
    } else if (elapsedTime < 20000) {
      status = 'Finalizing QBO file...'
    } else if (elapsedTime < 25000) {
      // Simulate successful completion
      status = 'Processing complete'
      processed = true
      qboUrl = `/api/bank-statement-processing/download?fileKey=${encodeURIComponent(fileKey)}`
    } else {
      // Simulate timeout for demo (in reality, processing might take longer)
      status = 'Processing taking longer than expected'
    }

    // Simulate occasional processing errors (5% chance)
    if (Math.random() < 0.05 && elapsedTime > 10000) {
      error = 'Unable to parse bank statement format. Please ensure the file is a valid bank statement.'
      status = 'Processing failed'
      processed = false
      qboUrl = null
    }

    return NextResponse.json({
      fileKey,
      status,
      processed,
      qboUrl,
      error,
      elapsedTime: Math.floor(elapsedTime / 1000),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking processing status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function extractTimestampFromFileKey(fileKey: string): number {
  try {
    // Extract timestamp from fileKey format: bank-statements/{timestamp}_{randomId}.{ext}
    const parts = fileKey.split('/')
    if (parts.length > 1) {
      const filename = parts[parts.length - 1]
      const timestampPart = filename.split('_')[0]
      return parseInt(timestampPart, 10)
    }
    return Date.now() - 30000 // Fallback to 30 seconds ago
  } catch {
    return Date.now() - 30000 // Fallback to 30 seconds ago
  }
}