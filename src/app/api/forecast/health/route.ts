import { NextResponse } from 'next/server'

const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    console.log(`[Health Check GET] Checking: ${FORECAST_API_URL}/health`)
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10秒でタイムアウト
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
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(60000), // 60秒でタイムアウト（Render無料プランの起動時間を考慮）
    })

    console.log(`[Health Check POST] Response: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ status: 'started', ...data })
    } else {
      return NextResponse.json({
        status: 'error',
        message: 'サーバー起動に失敗しました',
        responseStatus: response.status
      }, { status: 502 })
    }
  } catch (error) {
    console.error(`[Health Check POST] Error:`, error)
    return NextResponse.json({
      status: 'starting',
      message: 'サーバーを起動中です。1〜2分後に再確認してください。',
      error: error instanceof Error ? error.message : 'Unknown error',
      url: FORECAST_API_URL
    }, { status: 503 })
  }
}
