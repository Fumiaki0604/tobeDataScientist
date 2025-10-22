import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return new Response('Unauthorized', { status: 401 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendLog = (message: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: message })}\n\n`))
        }

        try {
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

          sendLog('アカウント一覧を取得中...')

          // アカウント一覧を取得
          const accounts: any[] = []
          let nextPageToken: string | null | undefined = undefined

          do {
            const accountsResponse: any = await analyticsAdmin.accounts.list({
              pageSize: 200,
              pageToken: nextPageToken || undefined,
            })

            if (accountsResponse.data.accounts) {
              accounts.push(...accountsResponse.data.accounts)
            }

            nextPageToken = accountsResponse.data.nextPageToken
          } while (nextPageToken)

          sendLog(`${accounts.length}件のアカウントを取得しました`)

          // 各アカウントのプロパティを取得
          const allProperties = []
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

          for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i]
            if (account.name) {
              try {
                if (i > 0) {
                  await delay(300)
                }

                let propertyPageToken: string | null | undefined = undefined
                let accountPropertyCount = 0

                do {
                  const propertiesResponse: any = await analyticsAdmin.properties.list({
                    filter: `parent:${account.name}`,
                    pageSize: 200,
                    pageToken: propertyPageToken || undefined,
                  })

                  const properties = propertiesResponse.data.properties || []
                  accountPropertyCount += properties.length

                  for (const property of properties) {
                    if (property.name && property.displayName) {
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

                  propertyPageToken = propertiesResponse.data.nextPageToken
                } while (propertyPageToken)

                sendLog(`${account.displayName}: ${accountPropertyCount}件`)
              } catch (error: any) {
                if (error?.code === 429 || error?.status === 429) {
                  sendLog(`レート制限エラー: 処理を中断`)
                  break
                }
              }
            }
          }

          // GA4プロパティのみフィルタリング
          const ga4Properties = allProperties.filter(
            prop => prop.propertyType === 'PROPERTY_TYPE_ORDINARY'
          )

          sendLog(`完了: ${ga4Properties.length}件のGA4プロパティ`)

          // 最終結果を送信
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            properties: ga4Properties
          })}\n\n`))

          controller.close()
        } catch (error) {
          sendLog(`エラー: ${error instanceof Error ? error.message : 'Unknown error'}`)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 })
  }
}
