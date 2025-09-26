import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'

// OpenAIクライアントの設定
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  name?: string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content?: string
      tool_calls?: Array<{
        id: string
        type: string
        function: {
          name: string
          arguments: string
        }
      }>
    }
  }>
}

const callOpenAI = async (
  messages: OpenAIMessage[],
  tools?: any[],
  toolChoice?: string
): Promise<{ content?: string; toolCalls?: any[] }> => {
  // 一時的にハードコードでAPIキーを設定
  const apiKey = process.env.OPENAI_API_KEY || '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'

  console.log('OpenAI API Call - API Key exists:', !!apiKey)

  const requestBody: any = {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools
    if (toolChoice) {
      requestBody.tool_choice = toolChoice
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30秒タイムアウト

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeout)

    console.log('OpenAI API Response:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API Error Details:', errorText)
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data: OpenAIResponse = await response.json()
    const message = data.choices[0]?.message

    if (message?.tool_calls && message.tool_calls.length > 0) {
      return { toolCalls: message.tool_calls }
    }

    return { content: message?.content || '回答を生成できませんでした。' }

  } catch (error) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      console.error('OpenAI API Timeout after 30 seconds')
      throw new Error('リクエストがタイムアウトしました。もう一度お試しください。')
    }
    throw error
  }
}

// 動的な日付計算関数
const calculateDateRange = (timeframe: string) => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // 特定月名への対応
  const monthNames = {
    '1月': 0, '2月': 1, '3月': 2, '4月': 3, '5月': 4, '6月': 5,
    '7月': 6, '8月': 7, '9月': 8, '10月': 9, '11月': 10, '12月': 11,
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  }

  // 特定月の処理
  const lowerTimeframe = timeframe.toLowerCase()
  for (const [monthName, monthIndex] of Object.entries(monthNames)) {
    if (lowerTimeframe.includes(monthName.toLowerCase())) {
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()

      // 指定月が今年のものか判断
      let targetYear = currentYear
      if (monthIndex > currentMonth) {
        // 来年の月の場合は前年を対象とする
        targetYear = currentYear - 1
      }

      const monthStart = new Date(targetYear, monthIndex, 1)
      const monthEnd = new Date(targetYear, monthIndex + 1, 0)

      return {
        startDate: monthStart.toISOString().split('T')[0],
        endDate: monthEnd.toISOString().split('T')[0]
      }
    }
  }

  switch (timeframe) {
    case 'today':
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }

    case 'yesterday':
      return {
        startDate: yesterday.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0]
      }

    case 'last_7_days':
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(today.getDate() - 7)
      return {
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }

    case 'last_week':
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(today.getDate() - today.getDay() - 1) // 先週の土曜日
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6) // 先週の日曜日
      return {
        startDate: lastWeekStart.toISOString().split('T')[0],
        endDate: lastWeekEnd.toISOString().split('T')[0]
      }

    case 'this_week':
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - today.getDay()) // 今週の日曜日
      return {
        startDate: thisWeekStart.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }

    case 'last_30_days':
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      return {
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }

    case 'this_month':
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return {
        startDate: thisMonthStart.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }

    case 'last_month':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        startDate: lastMonthStart.toISOString().split('T')[0],
        endDate: lastMonthEnd.toISOString().split('T')[0]
      }

    default:
      // デフォルトは過去7日間
      const defaultStart = new Date(today)
      defaultStart.setDate(today.getDate() - 7)
      return {
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      }
  }
}

// GA4データ取得用のツール定義
const analyticsTools = [
  {
    type: 'function',
    function: {
      name: 'get_analytics_data',
      description: 'Google Analytics 4からデータを取得します。質問に応じて適切な時期とメトリクスを指定してください。',
      parameters: {
        type: 'object',
        properties: {
          timeframe: {
            type: 'string',
            enum: ['today', 'yesterday', 'last_7_days', 'last_week', 'this_week', 'last_30_days', 'this_month', 'last_month', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            description: '取得するデータの時期（例：先週=last_week、今週=this_week、過去7日=last_7_days、現在の月=this_month、前月=last_month、特定月=9月、8月など）'
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['activeUsers', 'sessions', 'screenPageViews', 'bounceRate', 'sessionDuration', 'totalRevenue', 'transactions']
            },
            description: '取得するメトリクス（例：ユーザー数=activeUsers、セッション数=sessions、ページビュー=screenPageViews、売上=totalRevenue、トランザクション数=transactions）'
          },
          dimensions: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['date', 'country', 'city', 'deviceCategory', 'browser']
            },
            description: '分析の軸となるディメンション（通常は date を含める）'
          }
        },
        required: ['timeframe', 'metrics']
      }
    }
  }
]

// Analytics APIから直接データを取得
const fetchAnalyticsData = async (
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  metrics: string[] = ['activeUsers', 'sessions', 'screenPageViews'],
  dimensions: string[] = ['date']
) => {
  // Google Analytics Data APIを直接呼び出し
  const requestBody = {
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name })),
  }

  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Analytics API error: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  return result
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question, propertyId } = await request.json()

    if (!question || !propertyId) {
      return NextResponse.json({
        error: '質問とプロパティIDが必要です'
      }, { status: 400 })
    }

    console.log('🔍 User Question:', question)

    // Step 1: AIに質問を理解させて、必要なツール呼び出しを決定させる
    const systemPrompt = `あなたはGoogle Analytics 4の専門分析者です。
ユーザーからの質問に対して、適切なGA4データを取得するために必要なパラメータを決定してください。

現在の日付: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}

質問の例とパラメータ例：
- "先週のユーザー数は?" → timeframe: "last_week", metrics: ["activeUsers"]
- "今月のページビューの推移は?" → timeframe: "this_month", metrics: ["screenPageViews"], dimensions: ["date"]
- "昨日と今日のセッション数を比較" → timeframe: "last_7_days", metrics: ["sessions"], dimensions: ["date"]
- "先週と今週のPV数を比較" → timeframe: "last_7_days", metrics: ["screenPageViews"], dimensions: ["date", "deviceCategory"]
- "過去30日間の傾向を教えて" → timeframe: "last_30_days", metrics: ["activeUsers", "sessions", "screenPageViews"], dimensions: ["date"]
- "スマートフォンとデスクトップの売上を比較" → timeframe: "last_month", metrics: ["totalRevenue", "activeUsers"], dimensions: ["deviceCategory"]
- "9月のデバイス別売上は?" → timeframe: "9月", metrics: ["totalRevenue", "transactions"], dimensions: ["deviceCategory", "date"]
- "先週の売上とトランザクション数は?" → timeframe: "last_week", metrics: ["totalRevenue", "transactions"]

重要なポイント：
- 売上に関する質問には必ず "totalRevenue" メトリクスを含める
- デバイス別分析には "deviceCategory" ディメンションを含める
- トランザクション分析には "transactions" メトリクスを含める
- 比較や推移を求められた場合は適切なディメンション（date, deviceCategory等）を追加する
- 特定月の指定は月名で直接指定する（例：「9月」→ timeframe: "9月"、「8月」→ timeframe: "8月"）
- 期間比較（先週vs今週等）では包括的な期間（last_7_daysなど）と日付ディメンションで全データを取得する

必ず get_analytics_data 関数を使って、質問に答えるために最適なデータを取得してください。`

    const initialMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ]

    // Step 2: AIにツール呼び出しを決定させる
    console.log('🤖 AI analyzing question for data requirements...')
    const toolResponse = await callOpenAI(initialMessages, analyticsTools, 'auto')

    if (!toolResponse.toolCalls || toolResponse.toolCalls.length === 0) {
      // フォールバック: ツール呼び出しに失敗した場合
      console.log('⚠️ Tool calling failed, using fallback')
      const fallbackResponse = await callOpenAI(initialMessages)
      return NextResponse.json({
        success: true,
        response: fallbackResponse.content,
        dataUsed: false
      })
    }

    // Step 3: AIが決定したパラメータでGA4データを取得
    const toolCall = toolResponse.toolCalls[0]
    const functionArgs = JSON.parse(toolCall.function.arguments)
    console.log('📊 AI determined parameters:', functionArgs)

    const { timeframe, metrics = ['activeUsers', 'sessions', 'screenPageViews'], dimensions = ['date'] } = functionArgs

    // 日付範囲を計算
    const { startDate, endDate } = calculateDateRange(timeframe)
    console.log('📅 Date range:', { timeframe, startDate, endDate })

    // GA4データを取得
    let analyticsData = null
    try {
      analyticsData = await fetchAnalyticsData(
        propertyId,
        session.accessToken,
        startDate,
        endDate,
        metrics,
        dimensions
      )
      console.log('✅ Analytics data fetched successfully')
    } catch (analyticsError) {
      console.error('❌ Analytics API エラー:', analyticsError)
    }

    // Step 4: 取得したデータでAIが最終回答を生成
    const analysisPrompt = `あなたはGoogle Analytics 4の専門分析者です。
取得したデータを基に、ユーザーの質問に対して具体的で分かりやすい日本語の回答を提供してください。

重要な注意事項：
- ユーザーが「売上」について質問した場合は、必ずtotalRevenueデータを使用して回答してください
- デバイス別分析では、deviceCategoryディメンションのデータを活用してください
- 質問されていないメトリクス（activeUsers、sessionsなど）で回答を埋めることは避けてください
- 具体的な数値が取得できない場合は、その旨を正直に伝えてください

回答は以下の形式を心がけてください：
1. 具体的な数値とデータ（質問に直接関連するもの）
2. トレンドや変化の分析
3. 可能性のある原因や要因
4. 改善提案やアクションアイテム

データが取得できた場合は、そのデータに基づいて詳細な分析を提供してください。`

    const analysisMessages: OpenAIMessage[] = [
      { role: 'system', content: analysisPrompt },
      { role: 'user', content: question },
      {
        role: 'function',
        name: 'get_analytics_data',
        content: JSON.stringify({
          timeframe,
          startDate,
          endDate,
          metrics,
          dimensions,
          data: analyticsData
        })
      }
    ]

    console.log('🧠 AI generating final analysis...')
    const finalResponse = await callOpenAI(analysisMessages)

    return NextResponse.json({
      success: true,
      response: finalResponse.content,
      dataUsed: analyticsData !== null,
      timeframe,
      dateRange: { startDate, endDate },
      metrics,
      dimensions
    })

  } catch (error) {
    console.error('Chat API エラー:', error)

    return NextResponse.json(
      {
        error: '分析の実行中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}