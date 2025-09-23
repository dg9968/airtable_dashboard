import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
})

const base = airtable.base(process.env.AIRTABLE_BASE_ID || '')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerName = searchParams.get('customer')

    if (!customerName) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      )
    }

    console.log(`Fetching subscriptions for customer: ${customerName}`)

    // Use Airtable's filterByFormula to only fetch records for this customer
    const subscriptions: any[] = []

    await base('Subscriptions Corporate')
      .select({
        view: 'Services by Client All',
        // Filter records where Name field starts with the customer name
        filterByFormula: `SEARCH("${customerName} - ", {Name}) = 1`,
        maxRecords: 100 // Limit results since we're filtering for one customer
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          const subscriptionName = record.fields['Name'] || ''
          const serviceName = subscriptionName.replace(customerName + ' - ', '')

          subscriptions.push({
            id: record.id,
            clientId: customerName,
            serviceId: serviceName,
            status: record.fields['Status'] || [],
            price: record.fields['Billing Amount'] || 0,
            fields: record.fields
          })
        })
        fetchNextPage()
      })

    console.log(`Found ${subscriptions.length} subscriptions for ${customerName}`)

    return NextResponse.json({
      success: true,
      data: subscriptions,
      customerName: customerName,
      totalRecords: subscriptions.length
    })

  } catch (error) {
    console.error('Error fetching customer subscriptions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer subscriptions'
      },
      { status: 500 }
    )
  }
}