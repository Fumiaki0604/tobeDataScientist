import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'
import { decryptToken } from '@/lib/slack/crypto'
import { createDailyQuestionMessage } from '@/lib/slack/messages'

export const dynamic = 'force-dynamic'

/**
 * テスト配信用エンドポイント
 * 管理画面から即座に配信テストを実行
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // ユーザー認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 管理者チェック
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // アクティブなSlack連携を取得
    const { data: integration, error: integrationError } = await supabase
      .from('slack_integrations')
      .select('*')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'No active Slack integration found' },
        { status: 404 }
      )
    }

    // 配信設定を取得
    const { data: settings, error: settingsError } = await supabase
      .from('slack_daily_delivery_settings')
      .select('*')
      .eq('workspace_id', integration.workspace_id)
      .eq('is_active', true)
      .maybeSingle()

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      return NextResponse.json(
        { error: 'Failed to fetch delivery settings' },
        { status: 500 }
      )
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'No active delivery settings found' },
        { status: 404 }
      )
    }

    // ランダムに問題を選択
    let query = supabase
      .from('questions')
      .select('*')
      .order('id', { ascending: true })

    // 難易度フィルタ
    if (settings.difficulty_filter && settings.difficulty_filter.length > 0) {
      query = query.in('difficulty', settings.difficulty_filter)
    }

    // カテゴリフィルタ
    if (settings.category_filter && settings.category_filter.length > 0) {
      query = query.in('category', settings.category_filter)
    }

    const { data: questions, error: questionsError } = await query

    if (questionsError || !questions || questions.length === 0) {
      console.error('Error fetching questions:', questionsError)
      return NextResponse.json(
        { error: 'No questions found matching the filters' },
        { status: 404 }
      )
    }

    // ランダムに1問選択
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]

    // 配信記録を作成（テスト配信用）
    const { data: delivery, error: deliveryError } = await supabase
      .from('slack_daily_deliveries')
      .insert({
        workspace_id: integration.workspace_id,
        channel_id: settings.channel_id,
        channel_name: settings.channel_name,
        question_id: randomQuestion.id,
        status: 'pending',
      })
      .select()
      .single()

    if (deliveryError || !delivery) {
      console.error('Error creating delivery record:', deliveryError)
      return NextResponse.json(
        { error: 'Failed to create delivery record' },
        { status: 500 }
      )
    }

    // Slackにメッセージを送信
    const botToken = await decryptToken(integration.access_token_encrypted)
    const slack = new WebClient(botToken)

    const message = createDailyQuestionMessage(randomQuestion, delivery.id)

    try {
      const result = await slack.chat.postMessage({
        channel: settings.channel_id,
        ...message,
      })

      // 配信記録を更新
      await supabase
        .from('slack_daily_deliveries')
        .update({
          message_ts: result.ts,
          status: 'delivered',
        })
        .eq('id', delivery.id)

      return NextResponse.json({
        success: true,
        message: 'Test delivery sent successfully',
        delivery_id: delivery.id,
        channel: settings.channel_name,
        question_id: randomQuestion.id,
      })
    } catch (slackError: any) {
      console.error('Error sending to Slack:', slackError)

      // エラーを記録
      await supabase
        .from('slack_daily_deliveries')
        .update({
          status: 'failed',
          error_message: slackError.message,
        })
        .eq('id', delivery.id)

      return NextResponse.json(
        { error: slackError.message || 'Failed to send message to Slack' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in test delivery:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
