import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { GA4Client } from '../../../mcp-modules/ga4-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // セッションにエラーがある場合（トークンリフレッシュに失敗した場合など）
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json({
        error: 'Authentication session expired. Please sign in again.',
        needsReauth: true
      }, { status: 401 })
    }

    const { question, propertyId, conversationHistory } = await request.json()

    if (!question || !propertyId) {
      return NextResponse.json({
        error: '質問とプロパティIDが必要です'
      }, { status: 400 })
    }

    console.log('🔍 User Question:', question)
    console.log('🏢 Property ID:', propertyId)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    const ga4Client = new GA4Client()

    // OpenAI Function Calling用のツール定義
    const tools = [
      {
        type: 'function',
        function: {
          name: 'fetch_ga4_data',
          description: 'Google Analytics 4 (GA4) からデータを取得します。ユーザーの質問に基づいて適切なメトリクス、ディメンション、日付範囲を指定してください。',
          parameters: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: '開始日 (YYYY-MM-DD形式)。例: 2025-09-27'
              },
              endDate: {
                type: 'string',
                description: '終了日 (YYYY-MM-DD形式)。例: 2025-09-27'
              },
              metrics: {
                type: 'array',
                items: { type: 'string' },
                description: '取得するメトリクス。利用可能: totalRevenue(総収益), itemRevenue(商品売上), screenPageViews(PV), activeUsers(ユーザー数), sessions(セッション数), transactions(トランザクション数), itemsViewed(商品閲覧数), itemsPurchased(購入商品数)'
              },
              dimensions: {
                type: 'array',
                items: { type: 'string' },
                description: '取得するディメンション。利用可能: date(日付), itemName(商品名), deviceCategory(デバイス), pagePath(ページパス), pageTitle(ページタイトル), sessionSource(ソース), sessionDefaultChannelGrouping(チャネル), itemCategory(商品カテゴリ)'
              },
              dimensionFilter: {
                type: 'object',
                description: 'ディメンションのフィルター条件（特定のページや商品のみを取得する場合に使用）',
                properties: {
                  fieldName: {
                    type: 'string',
                    description: 'フィルター対象のディメンション名（例: pagePath, itemName）'
                  },
                  stringFilter: {
                    type: 'object',
                    properties: {
                      matchType: {
                        type: 'string',
                        enum: ['EXACT', 'BEGINS_WITH', 'ENDS_WITH', 'CONTAINS', 'FULL_REGEXP', 'PARTIAL_REGEXP'],
                        description: 'マッチタイプ。EXACT=完全一致, CONTAINS=部分一致, BEGINS_WITH=前方一致'
                      },
                      value: {
                        type: 'string',
                        description: 'フィルター値（例: /shop/goods/search.aspx）'
                      }
                    },
                    required: ['matchType', 'value']
                  }
                },
                required: ['fieldName', 'stringFilter']
              }
            },
            required: ['startDate', 'endDate', 'metrics']
          }
        }
      }
    ]

    try {
      // OpenAIにFunction Callingで質問を送信
      console.log('🤖 Sending question to OpenAI with Function Calling...')

      const messages: any[] = [
        {
          role: 'system',
          content: `あなたはGoogle Analytics 4のデータ分析アシスタントです。ユーザーの質問に基づいて、適切なGA4データを取得し、分析結果を日本語で回答してください。

今日の日付: ${new Date().toISOString().split('T')[0]}

重要な注意事項:
- 「9/27」「9月27日」など特定の日付が指定された場合、その日のみのデータを取得してください（startDateとendDateを同じ日付に）
- 「先週」「今月」など相対的な期間は、今日の日付を基準に計算してください
- 商品の売上やランキングを聞かれた場合は、metrics=['itemRevenue'], dimensions=['itemName']を使用してください
- デバイス別の分析にはdimensions=['deviceCategory']を使用してください
- 日別の推移にはdimensions=['date']を使用してください
- **重要**: 特定のURL・ページ・商品が指定された場合は、必ずdimensionFilterを使用してください

  フィルター使用例:
  1. 「/shop/goods/search.aspx を含むページ」
     → dimensionFilter={ fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/shop/goods/search.aspx' } }

  2. 「商品名にナイキを含む売上」
     → dimensionFilter={ fieldName: 'itemName', stringFilter: { matchType: 'CONTAINS', value: 'ナイキ' } }

  3. 「/shop/g/で始まるページ」
     → dimensionFilter={ fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/shop/g/' } }

  4. 「特定の商品『ナイキ エアマックス 90』」
     → dimensionFilter={ fieldName: 'itemName', stringFilter: { matchType: 'EXACT', value: 'ナイキ エアマックス 90' } }

- フィルターを使わないと全データが返され、データサイズが大きくなりすぎてエラーになるため、必ずフィルターを使用してください

メトリクスとディメンションの互換性:
- アイテム関連メトリクス（itemRevenue, itemsPurchased）は、アイテム関連ディメンション（itemName, itemCategory）とのみ組み合わせ可能です
- アイテム関連メトリクスは、date, pagePath, pageTitle, sessionSource, sessionDefaultChannelGroupingなどの標準ディメンションとは組み合わせできません
- 売上合計が必要な場合は、itemRevenueではなくtotalRevenueメトリクスを使用してください
- セッション数やPVと一緒に売上を表示する場合は、totalRevenueを使用してください`
        }
      ]

      // 会話履歴を追加
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory)
      }

      // ユーザーの質問を追加
      messages.push({
        role: 'user',
        content: question
      })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          tools,
          tool_choice: 'auto'
        })
      })

      console.log('🌐 OpenAI API Response Status:', response.status, response.statusText)

      const result = await response.json()
      console.log('📩 OpenAI response:', JSON.stringify(result, null, 2))

      // HTTPステータスコードのチェック
      if (!response.ok) {
        console.error('❌ OpenAI API HTTP Error:', response.status, result)
        return NextResponse.json({
          success: false,
          response: `OpenAI APIエラー: ${result.error?.message || 'Unknown error'}`,
          error: result.error?.message || `HTTP ${response.status}`,
        })
      }

      // レスポンスの検証
      if (!result.choices || result.choices.length === 0) {
        console.error('❌ Invalid OpenAI response:', result)
        return NextResponse.json({
          success: false,
          response: 'AIからの応答が無効です。OpenAI APIの状態を確認してください。',
          error: result.error?.message || 'Invalid response format',
        })
      }

      // Function callがあるかチェック
      if (result.choices[0].message.tool_calls) {
        const toolCalls = result.choices[0].message.tool_calls
        console.log(`📞 Processing ${toolCalls.length} function call(s)...`)

        // アシスタントのメッセージを追加
        messages.push(result.choices[0].message)

        // 各Function Callを実行
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'fetch_ga4_data') {
            const args = JSON.parse(toolCall.function.arguments)
            console.log('📞 Function call arguments:', args)

            try {
              // GA4データ取得
              console.log('📈 Fetching GA4 data...')
              const fetchParams: any = {
                propertyId,
                startDate: args.startDate,
                endDate: args.endDate,
                metrics: args.metrics,
                dimensions: args.dimensions || [],
                accessToken: session.accessToken,
              };

              // dimensionFilterが指定されている場合は追加
              if (args.dimensionFilter) {
                fetchParams.dimensionFilter = args.dimensionFilter;
                console.log('🔍 Using dimension filter:', JSON.stringify(args.dimensionFilter));
              }

              const ga4Data = await ga4Client.fetchAnalyticsData(fetchParams)

              console.log('✅ GA4 data retrieved, rows:', ga4Data.length)

              // Function callの結果を追加
              const toolResultContent = JSON.stringify(ga4Data)
              console.log('📦 Tool result size:', toolResultContent.length, 'characters')

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: toolResultContent
              })
              console.log('✅ Tool result added to messages array')
            } catch (ga4Error: any) {
              console.error('❌ GA4 API Error:', ga4Error)

              // エラーメッセージから互換性エラーを検出
              const errorMessage = ga4Error.message || ''
              const isCompatibilityError = errorMessage.includes('incompatible') ||
                                          errorMessage.includes('itemRevenue')

              if (isCompatibilityError) {
                console.log('🔄 Detected compatibility error, asking AI to retry with different metrics...')

                // エラー情報をツール結果として返し、AIに修正を促す
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    error: true,
                    message: 'メトリクスとディメンションの組み合わせに互換性がありません。itemRevenueではなくtotalRevenueを使用するか、ディメンションをitemName等のアイテム関連のものに変更してください。',
                    originalRequest: args,
                    suggestion: 'itemRevenueをtotalRevenueに変更することを推奨します。'
                  })
                })
              } else {
                // その他のエラーの場合
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    error: true,
                    message: `GA4データの取得に失敗しました: ${errorMessage}`
                  })
                })
              }
            }
          }
        }

        console.log('✅ All function calls processed. Total messages:', messages.length)

        // すべてのFunction Call結果をOpenAIに返して最終回答を生成
        // エラーがあった場合、AIが自動的にリトライできるようにtoolsを含める
        console.log('🤖 Sending final response to OpenAI...')
        console.log('📨 Messages array size:', JSON.stringify(messages).length, 'characters')
        const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages,
            tools,
            tool_choice: 'auto'
          })
        })

        console.log('🌐 OpenAI Final API Response Status:', finalResponse.status, finalResponse.statusText)

        const finalResult = await finalResponse.json()
        console.log('📩 OpenAI final response:', JSON.stringify(finalResult, null, 2))

        // HTTPステータスコードのチェック
        if (!finalResponse.ok) {
          console.error('❌ OpenAI Final API HTTP Error:', finalResponse.status, finalResult)
          return NextResponse.json({
            success: false,
            response: `OpenAI APIエラー（最終回答）: ${finalResult.error?.message || 'Unknown error'}`,
            error: finalResult.error?.message || `HTTP ${finalResponse.status}`,
          })
        }

        // レスポンスの検証
        if (!finalResult.choices || finalResult.choices.length === 0) {
          console.error('❌ Invalid OpenAI final response:', finalResult)
          return NextResponse.json({
            success: false,
            response: 'AIからの最終応答が無効です。',
            error: finalResult.error?.message || 'Invalid response format',
          })
        }

        // 2回目のFunction Callがあるかチェック（リトライの場合）
        if (finalResult.choices[0].message.tool_calls) {
          console.log('🔄 AI is retrying with corrected parameters...')
          const retryToolCalls = finalResult.choices[0].message.tool_calls
          messages.push(finalResult.choices[0].message)

          for (const retryToolCall of retryToolCalls) {
            if (retryToolCall.function.name === 'fetch_ga4_data') {
              const retryArgs = JSON.parse(retryToolCall.function.arguments)
              console.log('📞 Retry with arguments:', retryArgs)

              try {
                const retryFetchParams: any = {
                  propertyId,
                  startDate: retryArgs.startDate,
                  endDate: retryArgs.endDate,
                  metrics: retryArgs.metrics,
                  dimensions: retryArgs.dimensions || [],
                  accessToken: session.accessToken,
                };

                // dimensionFilterが指定されている場合は追加
                if (retryArgs.dimensionFilter) {
                  retryFetchParams.dimensionFilter = retryArgs.dimensionFilter;
                  console.log('🔍 Retry using dimension filter:', JSON.stringify(retryArgs.dimensionFilter));
                }

                const retryData = await ga4Client.fetchAnalyticsData(retryFetchParams)

                console.log('✅ Retry successful, rows:', retryData.length)

                messages.push({
                  role: 'tool',
                  tool_call_id: retryToolCall.id,
                  content: JSON.stringify(retryData)
                })
              } catch (retryError: any) {
                console.error('❌ Retry failed:', retryError)
                messages.push({
                  role: 'tool',
                  tool_call_id: retryToolCall.id,
                  content: JSON.stringify({
                    error: true,
                    message: `リトライも失敗しました: ${retryError.message}`
                  })
                })
              }
            }
          }

          // リトライ後の最終回答を生成
          console.log('🔄 Sending retry final response to OpenAI...')
          const retryFinalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages
            })
          })

          console.log('🌐 OpenAI Retry Final API Response Status:', retryFinalResponse.status, retryFinalResponse.statusText)

          const retryFinalResult = await retryFinalResponse.json()
          console.log('📩 OpenAI retry final response:', JSON.stringify(retryFinalResult, null, 2))

          // HTTPステータスコードのチェック
          if (!retryFinalResponse.ok) {
            console.error('❌ OpenAI Retry Final API HTTP Error:', retryFinalResponse.status, retryFinalResult)
            return NextResponse.json({
              success: false,
              response: `OpenAI APIエラー（リトライ後）: ${retryFinalResult.error?.message || 'Unknown error'}`,
              error: retryFinalResult.error?.message || `HTTP ${retryFinalResponse.status}`,
            })
          }

          // レスポンスの検証
          if (!retryFinalResult.choices || retryFinalResult.choices.length === 0) {
            console.error('❌ Invalid OpenAI retry final response:', retryFinalResult)
            return NextResponse.json({
              success: false,
              response: 'AIからのリトライ後の応答が無効です。',
              error: retryFinalResult.error?.message || 'Invalid response format',
            })
          }

          const retryFinalAnswer = retryFinalResult.choices[0].message.content

          return NextResponse.json({
            success: true,
            response: retryFinalAnswer,
            dataUsed: true,
            functionCalls: toolCalls.length + retryToolCalls.length,
            retried: true
          })
        }

        const finalAnswer = finalResult.choices[0].message.content

        return NextResponse.json({
          success: true,
          response: finalAnswer,
          dataUsed: true,
          functionCalls: toolCalls.length,
        })
      }

      // Function callがない場合は直接回答
      return NextResponse.json({
        success: true,
        response: result.choices[0].message.content,
        dataUsed: false,
      })

    } catch (analysisError) {
      console.error('❌ Analysis Error:', analysisError)

      return NextResponse.json({
        success: false,
        response: 'データの分析中にエラーが発生しました。しばらくしてからもう一度お試しください。',
        error: analysisError instanceof Error ? analysisError.message : 'Unknown analysis error',
      })
    }

  } catch (error) {
    console.error('💥 API Route Error:', error)
    return NextResponse.json({
      success: false,
      response: 'システムエラーが発生しました。',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}