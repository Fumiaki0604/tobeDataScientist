import { NextResponse } from 'next/server'

const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    console.log(`[Health Check GET] Checking: ${FORECAST_API_URL}/health`)
    // タイムアウトを120秒に延長（Renderの起動完了を待つため）
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(120000), // 120秒でタイムアウト
    })

    console.log(`[Health Check GET] Response: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ status: 'ready', ...data })
    } else {
      return NextResponse.json({ status: 'error' }, { status: 502 })
    }
  } catch (error) {
    console.error(`[Health Check GET] Error:`, error)
    return NextResponse.json({
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
      url: FORECAST_API_URL
    }, { status: 503 })
  }
}

// POSTリクエストでサーバーを起動（Render.comのウェイクアップ用）
export async function POST() {
  try {
    console.log(`[Health Check POST] Waking up: ${FORECAST_API_URL}/health`)
    console.log(`[Health Check POST] Environment: FORECAST_API_URL=${FORECAST_API_URL}`)

    // 起動トリガーリクエストを投げっぱなし（5秒でタイムアウト）
    // Renderは最初のリクエストで起動を開始するが、応答は待たない
    fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }).catch((err) => {
      console.log(`[Health Check POST] Wake-up trigger sent (timeout expected):`, err.message)
    })

    // 即座に「起動中」ステータスを返す
    // クライアント側で定期的にGETでポーリングする
    console.log(`[Health Check POST] Wake-up signal sent. Client will poll for readiness.`)
    return NextResponse.json({
      status: 'starting',
      message: 'サーバー起動リクエストを送信しました。起動完了まで1-2分お待ちください。',
      debugInfo: {
        apiUrl: FORECAST_API_URL,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 })
  } catch (error) {
    console.error(`[Health Check POST] Unexpected error:`, error)
    return NextResponse.json({
      status: 'starting',
      message: 'サーバー起動リクエストを送信しました。起動完了まで1-2分お待ちください。',
      error: error instanceof Error ? error.message : 'Unknown error',
      debugInfo: {
        apiUrl: FORECAST_API_URL,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 })
  }
}
