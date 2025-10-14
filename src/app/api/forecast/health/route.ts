import { NextResponse } from 'next/server'

const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${FORECAST_API_URL}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10秒でタイムアウト
    })

    if (response.ok) {
      return NextResponse.json({ status: 'ready' })
    } else {
      return NextResponse.json({ status: 'error' }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({ status: 'waking' }, { status: 503 })
  }
}
