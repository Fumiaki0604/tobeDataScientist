import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { QueryAnalyzer } from '../../../mcp-modules/query-analyzer'
import { GA4Client } from '../../../mcp-modules/ga4-client'
import { DataProcessor } from '../../../mcp-modules/data-processor'

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

    const { question, propertyId, conversationHistory } = await request.json()

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

    // モジュールを直接初期化
    const queryAnalyzer = new QueryAnalyzer(apiKey)
    const ga4Client = new GA4Client()
    const dataProcessor = new DataProcessor()

    try {
      // Step 1: 質問を解析（会話履歴を含む）
      console.log('📊 Analyzing query...')
      if (conversationHistory && conversationHistory.length > 0) {
        console.log('💬 Conversation history:', conversationHistory.length, 'messages')
      }
      const analysisConfig = await queryAnalyzer.analyzeQuery(question, propertyId, conversationHistory)
      console.log('📋 Analysis config:', analysisConfig)

      // Step 2: QueryAnalyzerから日付範囲を計算
      let ga4Data: any;

      if (analysisConfig.analysisType === 'period_comparison') {
        // 期間比較の場合、LLMで質問から2つの期間を抽出
        console.log('📅 Extracting comparison periods with LLM...')
        const periods = await queryAnalyzer.extractComparisonPeriods(question)
        console.log('📅 Comparison periods:', periods)

        // 各期間の日付範囲を計算
        const dateRange1 = queryAnalyzer.calculateDateRangeFromPeriod(periods.period1)
        const dateRange2 = queryAnalyzer.calculateDateRangeFromPeriod(periods.period2)

        console.log('📅 Period 1 dates:', dateRange1)
        console.log('📅 Period 2 dates:', dateRange2)

        // 2つの期間のデータを取得
        const period1Data = await ga4Client.fetchAnalyticsData({
          propertyId,
          startDate: dateRange1.startDate,
          endDate: dateRange1.endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        const period2Data = await ga4Client.fetchAnalyticsData({
          propertyId,
          startDate: dateRange2.startDate,
          endDate: dateRange2.endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        ga4Data = {
          period1: {
            label: periods.period1.label,
            data: period1Data
          },
          period2: {
            label: periods.period2.label,
            data: period2Data
          }
        }
        console.log('✅ Comparison data retrieved')
      } else {
        // 通常の分析の場合
        const { startDate, endDate } = calculateDateRangeFromConfig(analysisConfig.timeframe)
        console.log('📅 Date range:', { startDate, endDate })

        console.log('📈 Fetching GA4 data...')
        ga4Data = await ga4Client.fetchAnalyticsData({
          propertyId,
          startDate,
          endDate,
          metrics: analysisConfig.metrics,
          dimensions: analysisConfig.dimensions,
          accessToken: session.accessToken,
        })

        console.log('✅ GA4 data retrieved, rows:', ga4Data.length)
      }

      // Step 4: データを処理・分析
      console.log('🧠 Processing data...')
      const finalAnswer = await dataProcessor.processData(
        ga4Data,
        question,
        analysisConfig.analysisType
      )
      console.log('💬 Final answer generated')

      return NextResponse.json({
        success: true,
        response: finalAnswer,
        dataUsed: true,
        analysisConfig,
        dataPoints: Array.isArray(ga4Data) ? ga4Data.length : 0,
      })

    } catch (analysisError) {
      console.error('❌ Analysis Error:', analysisError)

      // 分析でエラーが発生した場合のフォールバック
      return NextResponse.json({
        success: false,
        response: 'データの分析中にエラーが発生しました。しばらくしてからもう一度お試しください。',
        error: analysisError instanceof Error ? analysisError.message : 'Unknown analysis error',
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