import { NextResponse } from 'next/server'

const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10秒でタイムアウト
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ status: 'ready', ...data })
    } else {
      return NextResponse.json({ status: 'error' }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({ status: 'unavailable' }, { status: 503 })
  }
}

// POSTリクエストでサーバーを起動（Render.comのウェイクアップ用）
export async function POST() {
  try {
    const response = await fetch(`${FORECAST_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(30000), // 30秒でタイムアウト
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ status: 'started', ...data })
    } else {
      return NextResponse.json({ status: 'error', message: 'サーバー起動に失敗しました' }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'starting',
      message: 'サーバーを起動中です。30秒〜1分後に再確認してください。'
    }, { status: 503 })
  }
}
