import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
})

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '')

export async function POST(request: NextRequest) {
  try {
    const { subscriptionName, status, price } = await request.json()

    console.log('Creating subscription with data:', { subscriptionName, status, price })

    if (!subscriptionName) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: subscriptionName' },
        { status: 400 }
      )
    }

    // Create new subscription record in Subscriptions Corporate table
    const recordData: any = {
      'Name': subscriptionName, // Use concatenated name format
    }

    // Add Status field
    if (status !== undefined) {
      recordData['Status'] = status
    }

    // Add Billing Amount field
    if (price !== undefined) {
      recordData['Billing Amount'] = price
    }

    console.log('Creating record with data:', recordData)

    const record = await base('Subscriptions Corporate').create(recordData)

    return NextResponse.json({
      success: true,
      data: {
        id: record._rawJson.id,
        fields: record.fields
      }
    })

  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { subscriptionId, status, price } = await request.json()

    console.log('Updating subscription with data:', { subscriptionId, status, price })

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: subscriptionId' },
        { status: 400 }
      )
    }

    // Update existing subscription record
    const updateFields: any = {}

    // Update Status field (Multiple Select)
    if (status !== undefined) {
      if (status === '' || status === null) {
        // Clear the multiple select field by setting it to empty array
        updateFields['Status'] = []
        console.log('Clearing Status field (setting to empty array)')
      } else {
        // Set status as array for multiple select field
        updateFields['Status'] = [status]
        console.log('Setting Status to:', [status])
      }
    }

    // Update Billing Amount field
    if (price !== undefined) {
      updateFields['Billing Amount'] = price
    }

    console.log('Updating record with fields:', updateFields)

    const record = await base('Subscriptions Corporate').update(subscriptionId, updateFields)

    return NextResponse.json({
      success: true,
      data: {
        id: record._rawJson.id,
        fields: record.fields
      }
    })

  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update subscription',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Missing subscription ID' },
        { status: 400 }
      )
    }

    // Delete subscription record
    await base('Subscriptions Corporate').destroy(subscriptionId)

    return NextResponse.json({
      success: true,
      message: 'Subscription deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete subscription'
      },
      { status: 500 }
    )
  }
}