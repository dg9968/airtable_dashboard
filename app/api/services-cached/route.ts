import { NextRequest, NextResponse } from 'next/server'
import { fetchAllTableData } from '@/lib/airtable'

// Simple in-memory cache
let servicesCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const now = Date.now()

    // Check if we have valid cached data
    if (servicesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached services data')
      return NextResponse.json({
        success: true,
        data: servicesCache,
        cached: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      })
    }

    console.log('Fetching fresh services data from Airtable')

    // Fetch fresh data from Services Corporate table
    const records = await fetchAllTableData('Services Corporate')

    const services = records.map((record) => ({
      id: record.id,
      name: record.fields['Services'] || 'Unnamed Service',
      price: record.fields['Price'] || 0,
      description: record.fields['Description'] || '',
      category: record.fields['Category'] || null,
      billingCycle: record.fields['Billing Cycle'] || null
    }))

    // Update cache
    servicesCache = services
    cacheTimestamp = now

    console.log(`Cached ${services.length} services`)

    return NextResponse.json({
      success: true,
      data: services,
      cached: false,
      totalServices: services.length
    })

  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services'
      },
      { status: 500 }
    )
  }
}

// Optional: Add endpoint to clear cache
export async function DELETE() {
  servicesCache = null
  cacheTimestamp = 0

  return NextResponse.json({
    success: true,
    message: 'Services cache cleared'
  })
}