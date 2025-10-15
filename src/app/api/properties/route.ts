import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { google } from 'googleapis'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // デバッグ: セッション情報を確認
    console.log('Session user:', session.user?.email)
    console.log('Has access token:', !!session.accessToken)

    // OAuth2クライアントを設定
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Google Analytics Admin APIクライアントを作成
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    })

    // アカウント一覧を取得（最大50件に制限）
    const accountsResponse = await analyticsAdmin.accounts.list({
      pageSize: 50,
    })
    const accounts = accountsResponse.data.accounts || []

    // 各アカウントのプロパティを取得
    const allProperties = []
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]
      if (account.name) {
        try {
          // レート制限を回避するため、リクエスト間に遅延を追加（300ms）
          if (i > 0) {
            await delay(300)
          }

          const propertiesResponse = await analyticsAdmin.properties.list({
            filter: `parent:${account.name}`,
            pageSize: 50, // プロパティも最大50件に制限
          })

          const properties = propertiesResponse.data.properties || []

          for (const property of properties) {
            if (property.name && property.displayName) {
              // プロパティIDを抽出（例: "properties/123456789" → "123456789"）
              const propertyId = property.name.split('/').pop()

              allProperties.push({
                id: propertyId,
                name: property.displayName,
                websiteUrl: (property as any).websiteUrl || '',
                accountName: account.displayName || '',
                propertyType: property.propertyType || 'PROPERTY_TYPE_ORDINARY',
              })
            }
          }
        } catch (error: any) {
          // レート制限エラー（429）の場合は処理を中断
          if (error?.code === 429 || error?.status === 429) {
            console.error(`レート制限エラー: ${account.name}で処理を中断します`)
            break // これ以上のリクエストを送信しない
          }
          console.error(`アカウント ${account.name} のプロパティ取得エラー:`, error)
          // その他のエラーは無視して続行
        }
      }
    }

    // GA4プロパティのみフィルタリング
    const ga4Properties = allProperties.filter(
      prop => prop.propertyType === 'PROPERTY_TYPE_ORDINARY'
    )

    return NextResponse.json({
      success: true,
      properties: ga4Properties,
    })

  } catch (error) {
    console.error('GA4プロパティ取得エラー:', error)

    return NextResponse.json(
      {
        error: 'プロパティ一覧の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}