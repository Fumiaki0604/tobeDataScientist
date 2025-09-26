import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // アカウント一覧を取得
    const accountsResponse = await analyticsAdmin.accounts.list()
    const accounts = accountsResponse.data.accounts || []

    // 各アカウントのプロパティを取得
    const allProperties = []

    for (const account of accounts) {
      if (account.name) {
        try {
          const propertiesResponse = await analyticsAdmin.properties.list({
            filter: `parent:${account.name}`,
          })

          const properties = propertiesResponse.data.properties || []

          for (const property of properties) {
            if (property.name && property.displayName) {
              // プロパティIDを抽出（例: "properties/123456789" → "123456789"）
              const propertyId = property.name.split('/').pop()

              allProperties.push({
                id: propertyId,
                name: property.displayName,
                websiteUrl: property.websiteUrl || '',
                accountName: account.displayName || '',
                propertyType: property.propertyType || 'PROPERTY_TYPE_ORDINARY',
              })
            }
          }
        } catch (error) {
          console.error(`アカウント ${account.name} のプロパティ取得エラー:`, error)
          // 個別のエラーは無視して続行
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