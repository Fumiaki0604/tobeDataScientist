import { NextResponse } from 'next/server'

const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function GET() {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000 // 2秒

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Health Check GET] Attempt ${attempt}/${MAX_RETRIES}: Checking ${FORECAST_API_URL}/health`)

      const response = await fetch(`${FORECAST_API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(120000), // 120秒でタイムアウト
        headers: {
          'User-Agent': 'GA4-Dashboard-HealthCheck/1.0',
        },
      })

      console.log(`[Health Check GET] Attempt ${attempt}: Response ${response.status} ${response.statusText}`)

      if (response.ok) {
        const data = await response.json()
        return NextResponse.json({ status: 'ready', ...data })
      } else if (response.status === 502 && attempt < MAX_RETRIES) {
        console.log(`[Health Check GET] Got 502, retrying in ${RETRY_DELAY}ms...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        continue
      } else {
        return NextResponse.json({
          status: 'error',
          message: `Server responded with ${response.status}`,
          attempt
        }, { status: 502 })
      }
    } catch (error) {
      console.error(`[Health Check GET] Attempt ${attempt} error:`, error)

      if (attempt < MAX_RETRIES) {
        console.log(`[Health Check GET] Retrying in ${RETRY_DELAY}ms...`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        continue
      }

      return NextResponse.json({
        status: 'unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
        url: FORECAST_API_URL,
        attempts: MAX_RETRIES
      }, { status: 503 })
    }
  }

  // すべてのリトライが失敗
  return NextResponse.json({
    status: 'unavailable',
    error: 'All retry attempts failed',
    url: FORECAST_API_URL,
    attempts: MAX_RETRIES
  }, { status: 503 })
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
