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

    // Renderのコールドスタートを待つ（最大120秒）
    // 初回起動時はフォントキャッシュ構築で30秒以上かかる
    console.log(`[Health Check POST] Sending wake-up request (max 120s timeout)...`)

    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(120000), // 120秒待つ
      headers: {
        'User-Agent': 'GA4-Dashboard-WakeUp/1.0',
      },
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`[Health Check POST] Server woke up successfully!`, data)
      return NextResponse.json({
        status: 'ready',
        message: 'サーバーが起動しました',
        data
      }, { status: 200 })
    } else {
      console.log(`[Health Check POST] Server responded with ${response.status}, needs more time`)
      return NextResponse.json({
        status: 'starting',
        message: 'サーバー起動中です。もう少しお待ちください。',
        httpStatus: response.status
      }, { status: 200 })
    }
  } catch (error) {
    // タイムアウトまたはネットワークエラー
    console.error(`[Health Check POST] Wake-up error:`, error)

    // タイムアウトの場合は起動中として扱う
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        status: 'starting',
        message: 'サーバー起動に時間がかかっています。引き続きお待ちください。',
        error: 'タイムアウト（120秒経過）'
      }, { status: 200 })
    }

    return NextResponse.json({
      status: 'error',
      message: 'サーバー起動リクエストに失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}
