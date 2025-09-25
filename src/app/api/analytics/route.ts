import { NextRequest, NextResponse } from 'next/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { getServerSession } from 'next-auth/next'

// 簡易的なメモリストレージ（property APIと共通）
const userProperties = new Map<string, string>()

interface ExtendedSession {
  accessToken?: string
  user?: {
    email?: string
  }
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

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        access_token: session.accessToken
      }
    })

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      dimensions: dimensions.split(',').map(dim => ({ name: dim.trim() })),
      metrics: metrics.split(',').map(metric => ({ name: metric.trim() })),
    })

    const formattedData = response.rows?.map(row => {
      const data: Record<string, string | number> = {}

      response.dimensionHeaders?.forEach((header, index) => {
        data[header.name!] = row.dimensionValues?.[index]?.value
      })

      response.metricHeaders?.forEach((header, index) => {
        data[header.name!] = parseInt(row.metricValues?.[index]?.value || '0')
      })

      return data
    })

    return NextResponse.json({
      data: formattedData,
      dimensionHeaders: response.dimensionHeaders,
      metricHeaders: response.metricHeaders
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}