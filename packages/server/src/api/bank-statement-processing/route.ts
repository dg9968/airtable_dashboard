import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'staff' && session.user?.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const processingType = formData.get('processingType') as string
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (processingType !== 'bank-statement') {
      return NextResponse.json({ error: 'Invalid processing type' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not supported. Please upload PDF or CSV files.' }, { status: 400 })
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    // Generate unique file key for S3
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileKey = `incoming/${timestamp}_${randomId}.${fileExtension}`

    // Convert file to buffer for S3 upload
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to S3
    const bucketName = process.env.AWS_S3_BUCKET_NAME
    if (!bucketName) {
      return NextResponse.json({ error: 'AWS S3 bucket not configured' }, { status: 500 })
    }

    const uploadParams = {
      Bucket: bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedBy: session.user?.email || 'Unknown',
        processingType: 'bank-statement',
        uploadedAt: new Date().toISOString()
      }
    }

    try {
      const result = await s3Client.send(new PutObjectCommand(uploadParams))
      
      // S3 upload successful - this will trigger Lambda function via S3 event
      const uploadResult = {
        success: true,
        fileKey: fileKey,
        bucket: bucketName,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user?.email || 'Unknown',
        s3ETag: result.ETag,
        s3Location: `s3://${bucketName}/${fileKey}`
      }

      console.log('Bank statement uploaded to S3:', {
        fileKey,
        bucket: bucketName,
        size: file.size,
        user: session.user?.email
      })

      return NextResponse.json(uploadResult)

    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error)
      return NextResponse.json({ 
        error: 'Failed to upload file to S3. Please check AWS configuration.',
        details: process.env.NODE_ENV === 'development' ? String(s3Error) : undefined
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing bank statement upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET method for checking overall service health
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      service: 'Bank Statement Processing',
      status: 'operational',
      timestamp: new Date().toISOString(),
      message: 'Service is ready to process bank statements'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}