import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { getMCPClient } from '../../../lib/mcp-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // セッションにエラーがある場合（トークンリフレッシュに失敗した場合など）
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json({
        error: 'Authentication session expired. Please sign in again.',
        needsReauth: true
      }, { status: 401 })
    }

    const { question, propertyId } = await request.json()

    if (!question || !propertyId) {
      return NextResponse.json({
        error: '質問とプロパティIDが必要です'
      }, { status: 400 })
    }

    console.log('🔍 User Question:', question)
    console.log('🏢 Property ID:', propertyId)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    const mcpClient = getMCPClient(apiKey)

    try {
      // Step 1: MCPサーバーで質問を解析
      console.log('📊 Analyzing query with MCP server...')
      const analysisResult = await mcpClient.callTool('analyze_ga4_query', {
        question,
        propertyId,
      })

      const analysisConfig = JSON.parse(analysisResult.content[0].text)
      console.log('📋 Analysis config:', analysisConfig)

      // Step 2: QueryAnalyzerから日付範囲を計算
      let ga4Data: any;

      if (analysisConfig.analysisType === 'period_comparison') {
        // 期間比較の場合、質問から2つの期間を抽出
        console.log('📅 Extracting comparison periods...')
        const periods = extractComparisonPeriods(question)
        console.log('📅 Comparison periods:', periods)

        // 2つの期間のデータを取得
        const period1Data = await mcpClient.callTool('fetch_ga4_data', {
          propertyId,
          startDate: periods.period1.startDate,
          endDate: periods.period1.endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        const period2Data = await mcpClient.callTool('fetch_ga4_data', {
          propertyId,
          startDate: periods.period2.startDate,
          endDate: periods.period2.endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        ga4Data = {
          period1: {
            label: periods.period1.label,
            data: JSON.parse(period1Data.content[0].text)
          },
          period2: {
            label: periods.period2.label,
            data: JSON.parse(period2Data.content[0].text)
          }
        }
        console.log('✅ Comparison data retrieved')
      } else {
        // 通常の分析の場合
        const { startDate, endDate } = calculateDateRangeFromConfig(analysisConfig.timeframe)
        console.log('📅 Date range:', { startDate, endDate })

        console.log('📈 Fetching GA4 data...')
        const ga4DataResult = await mcpClient.callTool('fetch_ga4_data', {
          propertyId,
          startDate,
          endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        ga4Data = JSON.parse(ga4DataResult.content[0].text)
        console.log('✅ GA4 data retrieved, rows:', ga4Data.length)
      }

      // Step 4: MCPサーバーでデータを処理・分析
      console.log('🧠 Processing data with MCP server...')
      const processResult = await mcpClient.callTool('process_ga4_data', {
        data: ga4Data,
        question,
        analysisType: analysisConfig.analysisType,
      })

      const finalAnswer = processResult.content[0].text
      console.log('💬 Final answer generated')

      return NextResponse.json({
        success: true,
        response: finalAnswer,
        dataUsed: true,
        analysisConfig,
        dataPoints: ga4Data.length,
      })

    } catch (mcpError) {
      console.error('❌ MCP Server Error:', mcpError)

      // MCPサーバーでエラーが発生した場合のフォールバック
      return NextResponse.json({
        success: false,
        response: 'データの分析中にエラーが発生しました。しばらくしてからもう一度お試しください。',
        error: mcpError instanceof Error ? mcpError.message : 'Unknown MCP error',
      })
    }

  } catch (error) {
    console.error('💥 API Route Error:', error)
    return NextResponse.json({
      success: false,
      response: 'システムエラーが発生しました。',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

// 期間比較のための2つの期間を抽出
function extractComparisonPeriods(question: string) {
  const today = new Date()

  // 先月 vs 今月
  if (question.includes('先月') && question.includes('今月')) {
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

    return {
      period1: {
        label: '先月',
        startDate: formatDate(lastMonthStart),
        endDate: formatDate(lastMonthEnd)
      },
      period2: {
        label: '今月',
        startDate: formatDate(thisMonthStart),
        endDate: formatDate(today)
      }
    }
  }

  // 先週 vs 今週
  if (question.includes('先週') && question.includes('今週')) {
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay())

    const lastWeekEnd = new Date(today)
    lastWeekEnd.setDate(today.getDate() - today.getDay() - 1)
    const lastWeekStart = new Date(lastWeekEnd)
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6)

    return {
      period1: {
        label: '先週',
        startDate: formatDate(lastWeekStart),
        endDate: formatDate(lastWeekEnd)
      },
      period2: {
        label: '今週',
        startDate: formatDate(thisWeekStart),
        endDate: formatDate(today)
      }
    }
  }

  // デフォルト: 先月 vs 今月
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  return {
    period1: {
      label: '先月',
      startDate: formatDate(lastMonthStart),
      endDate: formatDate(lastMonthEnd)
    },
    period2: {
      label: '今月',
      startDate: formatDate(thisMonthStart),
      endDate: formatDate(today)
    }
  }
}

// 分析設定から日付範囲を計算するヘルパー関数
function calculateDateRangeFromConfig(timeframe: any): { startDate: string; endDate: string } {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (timeframe.type === 'named') {
    return handleNamedPeriod(timeframe.period, today)
  }

  switch (timeframe.period) {
    case 'today':
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      }

    case 'yesterday':
      return {
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday),
      }

    case 'last_7_days':
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(today.getDate() - 7)
      return {
        startDate: formatDate(sevenDaysAgo),
        endDate: formatDate(today),
      }

    case 'last_30_days':
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      return {
        startDate: formatDate(thirtyDaysAgo),
        endDate: formatDate(today),
      }

    case 'last_week':
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(today.getDate() - today.getDay() - 1)
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
      return {
        startDate: formatDate(lastWeekStart),
        endDate: formatDate(lastWeekEnd),
      }

    case 'this_week':
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - today.getDay())
      return {
        startDate: formatDate(thisWeekStart),
        endDate: formatDate(today),
      }

    case 'last_month':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        startDate: formatDate(lastMonth),
        endDate: formatDate(lastMonthEnd),
      }

    case 'this_month':
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return {
        startDate: formatDate(thisMonthStart),
        endDate: formatDate(today),
      }

    default:
      const defaultStart = new Date(today)
      defaultStart.setDate(today.getDate() - 7)
      return {
        startDate: formatDate(defaultStart),
        endDate: formatDate(today),
      }
  }
}

function handleNamedPeriod(period: string, today: Date): { startDate: string; endDate: string } {
  const monthNames: Record<string, number> = {
    '1月': 0, '2月': 1, '3月': 2, '4月': 3, '5月': 4, '6月': 5,
    '7月': 6, '8月': 7, '9月': 8, '10月': 9, '11月': 10, '12月': 11
  }

  const monthIndex = monthNames[period]
  if (monthIndex !== undefined) {
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    let targetYear = currentYear
    if (monthIndex > currentMonth) {
      targetYear = currentYear - 1
    }

    const monthStart = new Date(targetYear, monthIndex, 1)
    const monthEnd = new Date(targetYear, monthIndex + 1, 0)

    return {
      startDate: formatDate(monthStart),
      endDate: formatDate(monthEnd),
    }
  }

  const defaultStart = new Date(today)
  defaultStart.setDate(today.getDate() - 7)
  return {
    startDate: formatDate(defaultStart),
    endDate: formatDate(today),
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}