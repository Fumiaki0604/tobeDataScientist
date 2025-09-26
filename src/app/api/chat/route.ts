import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'

// OpenAIクライアントの設定
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

const callOpenAI = async (messages: OpenAIMessage[]): Promise<string> => {
  // 一時的にハードコードでAPIキーを設定
  const apiKey = process.env.OPENAI_API_KEY || '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'

  console.log('OpenAI API Call - API Key exists:', !!apiKey)
  console.log('OpenAI API Call - API Key prefix:', apiKey.substring(0, 10))
  console.log('OpenAI API Call - process.env.OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  console.log('OpenAI API Response:', response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenAI API Error Details:', errorText)
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data: OpenAIResponse = await response.json()
  return data.choices[0]?.message?.content || '回答を生成できませんでした。'
}

// 日付解析ヘルパー関数
const parseDateFromQuestion = (question: string) => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const patterns = [
    { pattern: /昨日|yesterday/i, days: 1 },
    { pattern: /今日|today/i, days: 0 },
    { pattern: /一昨日/i, days: 2 },
    { pattern: /3日前/i, days: 3 },
    { pattern: /1週間前|先週/i, days: 7 },
    { pattern: /2週間前/i, days: 14 },
    { pattern: /1ヶ月前|先月/i, days: 30 },
  ]

  const dateRanges = []

  for (const { pattern, days } of patterns) {
    if (pattern.test(question)) {
      const date = new Date(today)
      date.setDate(date.getDate() - days)
      dateRanges.push(date.toISOString().split('T')[0])
    }
  }

  // デフォルトは昨日と今日
  if (dateRanges.length === 0) {
    return [
      yesterday.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    ]
  }

  return dateRanges
}

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

    // 質問から日付範囲を解析
    const dates = parseDateFromQuestion(question)
    let analyticsData = null

    try {
      // GA4データを取得
      if (dates.length >= 2) {
        analyticsData = await fetchAnalyticsData(
          propertyId,
          session.accessToken,
          dates[0],
          dates[dates.length - 1]
        )
      } else if (dates.length === 1) {
        analyticsData = await fetchAnalyticsData(
          propertyId,
          session.accessToken,
          dates[0],
          dates[0]
        )
      }
    } catch (analyticsError) {
      console.error('Analytics API エラー:', analyticsError)
      // Analytics APIのエラーがあってもAIに質問は送る
    }

    // AIに分析を依頼
    const systemPrompt = `あなたはGoogle Analyticsの専門分析者です。
ユーザーからの質問に対して、提供されたデータを分析し、日本語で分かりやすく回答してください。

提供データがある場合は、そのデータを基に具体的な数値と洞察を提供してください。
データがない場合は、一般的なGA4分析のアドバイスを提供してください。

回答は以下の形式を心がけてください：
1. 具体的な数値（データがある場合）
2. トレンドや変化の分析
3. 可能性のある原因や要因
4. 改善提案やアクションアイテム

簡潔で実用的な回答を心がけてください。`

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `質問: ${question}\n\nGA4データ: ${analyticsData ? JSON.stringify(analyticsData, null, 2) : 'データの取得に失敗しました'}`
      }
    ]

    const aiResponse = await callOpenAI(messages)

    return NextResponse.json({
      success: true,
      response: aiResponse,
      dataUsed: analyticsData !== null,
      dates: dates
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