import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'

// 簡易的なメモリストレージ（本番環境ではデータベースを使用することを推奨）
const userProperties = new Map<string, string>()

interface ExtendedSession {
  user?: {
    email?: string
  }
  [key: string]: any
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { propertyId } = await request.json()

    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json({ error: 'Invalid property ID' }, { status: 400 })
    }

    // プロパティIDを保存
    userProperties.set(session.user.email, propertyId)

    return NextResponse.json({ success: true, propertyId })

  } catch (error) {
    console.error('Property API error:', error)
    return NextResponse.json(
      { error: 'Failed to save property ID' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const propertyId = userProperties.get(session.user.email)

    return NextResponse.json({ propertyId: propertyId || null })

  } catch (error) {
    console.error('Property API error:', error)
    return NextResponse.json(
      { error: 'Failed to get property ID' },
      { status: 500 }
    )
  }
}