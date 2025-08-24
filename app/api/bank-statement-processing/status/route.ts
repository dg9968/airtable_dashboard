import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

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

    // Convert incoming file key to parsed directory key
    const parsedFileKey = fileKey
      .replace('incoming/', 'parsed/')
      .replace(/\.(pdf|csv|xlsx?)$/i, '.qbo')

    const bucketName = process.env.AWS_S3_BUCKET_NAME
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS S3 bucket not configured' }, { status: 500 })
    }

    // Calculate elapsed time for all scenarios
    const uploadTime = extractTimestampFromFileKey(fileKey)
    const currentTime = Date.now()
    const elapsedTime = currentTime - uploadTime

    // Check if processed file exists in S3
    let processed = false
    let qboUrl: string | null = null
    let status: string
    let error: string | null = null

    try {
      // Check if the processed QBO file exists
      await s3Client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: parsedFileKey
      }))
      
      // File exists, processing is complete
      processed = true
      status = 'Processing complete'
      qboUrl = `/api/bank-statement-processing/download?fileKey=${encodeURIComponent(fileKey)}`
      
    } catch (s3Error: any) {
      // File doesn't exist yet, check processing time for status
      if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        // File not processed yet, show processing stages based on elapsed time
        if (elapsedTime < 10000) {
          status = 'Processing bank statement...'
        } else if (elapsedTime < 30000) {
          status = 'Extracting transaction data...'
        } else if (elapsedTime < 60000) {
          status = 'Converting to QBO format...'
        } else if (elapsedTime < 90000) {
          status = 'Finalizing QBO file...'
        } else {
          status = 'Processing taking longer than expected. Please check back later.'
        }
      } else {
        // Other S3 error
        console.error('S3 status check error:', s3Error)
        error = 'Unable to check processing status'
        status = 'Status check failed'
      }
    }

    return NextResponse.json({
      fileKey,
      parsedFileKey, // Add this for debugging
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
    // Extract timestamp from fileKey format: incoming/{timestamp}_{randomId}.{ext}
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