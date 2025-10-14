import { NextRequest, NextResponse } from 'next/server'

// 環境変数からPython予測APIのURLを取得（デフォルトはローカル）
const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    console.log('Forecast API URL:', FORECAST_API_URL)

    const body = await request.json()
    const { data, periods, metric_name } = body

    console.log('Request data length:', data?.length)

    // バリデーション
    if (!data || !Array.isArray(data) || data.length < 7) {
      return NextResponse.json(
        { error: '予測には最低7日分のデータが必要です' },
        { status: 400 }
      )
    }

    // Python予測APIを呼び出し
    console.log('Calling Python API:', `${FORECAST_API_URL}/forecast`)
    const response = await fetch(`${FORECAST_API_URL}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        periods: periods || 30,
        metric_name: metric_name || '売上',
      }),
    })

    console.log('Python API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Python API error:', errorText)
      throw new Error(`予測APIエラー: ${errorText}`)
    }

    const forecastData = await response.json()
    return NextResponse.json(forecastData)
  } catch (error) {
    console.error('予測エラー:', error)
    return NextResponse.json(
      {
        error: '予測処理に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
        apiUrl: FORECAST_API_URL,
      },
      { status: 500 }
    )
  }
}
