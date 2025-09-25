import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

// 簡易的なメモリストレージ（property APIと共通）
const userProperties = new Map<string, string>()

interface ExtendedSession {
  accessToken?: string
  user?: {
    email?: string
  }
}

interface AnalyticsAPIResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>
    metricValues?: Array<{ value: string }>
  }>
  dimensionHeaders?: Array<{ name: string }>
  metricHeaders?: Array<{ name: string }>
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession() as ExtendedSession

    if (!session?.accessToken || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ユーザーのプロパティIDを取得
    const propertyId = userProperties.get(session.user.email)

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID not set' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '7daysAgo'
    const endDate = searchParams.get('endDate') || 'today'
    const metrics = searchParams.get('metrics') || 'activeUsers,sessions,pageviews'
    const dimensions = searchParams.get('dimensions') || 'date'

    // Google Analytics Data API REST APIを直接呼び出し
    const requestBody = {
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      dimensions: dimensions.split(',').map(dim => ({ name: dim.trim() })),
      metrics: metrics.split(',').map(metric => ({ name: metric.trim() })),
    }

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const apiResult: AnalyticsAPIResponse = await response.json()

    const formattedData = apiResult.rows?.map((row) => {
      const data: Record<string, string | number> = {}

      apiResult.dimensionHeaders?.forEach((header, index) => {
        data[header.name] = row.dimensionValues?.[index]?.value || ''
      })

      apiResult.metricHeaders?.forEach((header, index) => {
        data[header.name] = parseInt(row.metricValues?.[index]?.value || '0')
      })

      return data
    })

    return NextResponse.json({
      data: formattedData || [],
      dimensionHeaders: apiResult.dimensionHeaders,
      metricHeaders: apiResult.metricHeaders
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}