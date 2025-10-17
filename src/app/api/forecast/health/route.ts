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

    // まず短いタイムアウトで試行（5秒）
    const quickCheck = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)

    // すぐに応答があれば成功
    if (quickCheck?.ok) {
      console.log(`[Health Check POST] Already running!`)
      const data = await quickCheck.json()
      return NextResponse.json({ status: 'started', ...data })
    }

    console.log(`[Health Check POST] Server not ready, triggering wake-up...`)

    // サーバーがまだ起動していない場合は、起動リクエストを送信
    // タイムアウトは長めに設定するが、エラーでも「starting」を返す
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(90000), // 90秒
    }).catch((error) => {
      console.log(`[Health Check POST] Timeout/Error (expected):`, error.message)
      return null
    })

    if (response?.ok) {
      console.log(`[Health Check POST] Response: ${response.status} ${response.statusText}`)
      const data = await response.json()
      return NextResponse.json({ status: 'started', ...data })
    }

    // タイムアウトまたはエラーの場合も「starting」として扱う
    // Renderは起動プロセスを開始している可能性が高い
    console.log(`[Health Check POST] Wake-up signal sent, server starting...`)
    return NextResponse.json({
      status: 'starting',
      message: 'サーバー起動リクエストを送信しました。1〜2分お待ちください。',
    }, { status: 200 }) // 200を返してリトライロジックを発動
  } catch (error) {
    console.error(`[Health Check POST] Unexpected error:`, error)
    return NextResponse.json({
      status: 'starting',
      message: 'サーバー起動リクエストを送信しました。1〜2分お待ちください。',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }) // 200を返してリトライロジックを発動
  }
}
