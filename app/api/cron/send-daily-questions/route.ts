import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'
import { decryptToken } from '@/lib/slack/crypto'
import { createDailyQuestionMessage } from '@/lib/slack/messages'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron Job用エンドポイント
 * 毎日指定時刻に問題を配信
 */
export async function GET(request: NextRequest) {
  try {
    // Cron Secretで認証
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // アクティブなSlack連携を取得
    const { data: integration, error: integrationError } = await supabase
      .from('slack_integrations')
      .select('*')
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      console.error('No active integration:', integrationError)
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
      console.log('No active delivery settings found')
      return NextResponse.json(
        { message: 'No active delivery settings' },
        { status: 200 }
      )
    }

    // 現在時刻と配信時刻を比較（JST）
    const now = new Date()
    const jstOffset = 9 * 60 // JST is UTC+9
    const jstNow = new Date(now.getTime() + jstOffset * 60 * 1000)
    const currentHour = jstNow.getUTCHours()
    const currentMinute = jstNow.getUTCMinutes()

    const [deliveryHour, deliveryMinute] = settings.delivery_time
      .split(':')
      .map(Number)

    // 配信時刻の±5分以内でない場合はスキップ
    const timeDiff = Math.abs(
      currentHour * 60 + currentMinute - (deliveryHour * 60 + deliveryMinute)
    )
    if (timeDiff > 5) {
      console.log(
        `Skipping delivery: current time ${currentHour}:${currentMinute} is not within 5 minutes of ${deliveryHour}:${deliveryMinute}`
      )
      return NextResponse.json({ message: 'Not delivery time' }, { status: 200 })
    }

    // 今日既に配信済みかチェック
    const today = jstNow.toISOString().split('T')[0]
    const { data: existingDelivery } = await supabase
      .from('slack_daily_deliveries')
      .select('id')
      .eq('workspace_id', integration.workspace_id)
      .gte('delivered_at', `${today}T00:00:00Z`)
      .lt('delivered_at', `${today}T23:59:59Z`)
      .maybeSingle()

    if (existingDelivery) {
      console.log('Already delivered today')
      return NextResponse.json(
        { message: 'Already delivered today' },
        { status: 200 }
      )
    }

    // ランダムに問題を取得
    const question = await getRandomQuestion(supabase, settings)

    if (!question) {
      console.error('No question found')
      return NextResponse.json({ error: 'No question available' }, { status: 404 })
    }

    // Slack Botトークンを復号化
    const botToken = await decryptToken(integration.access_token_encrypted)
    const slack = new WebClient(botToken)

    // 配信レコードを作成（メッセージ送信前に作成してIDを取得）
    const { data: delivery, error: deliveryError } = await supabase
      .from('slack_daily_deliveries')
      .insert({
        workspace_id: integration.workspace_id,
        channel_id: settings.channel_id,
        channel_name: settings.channel_name,
        question_id: question.id,
        status: 'pending',
      })
      .select()
      .single()

    if (deliveryError || !delivery) {
      console.error('Failed to create delivery record:', deliveryError)
      throw new Error('Failed to create delivery record')
    }

    // Slackにメッセージを送信
    try {
      const message = createDailyQuestionMessage(question, delivery.id)
      const result = await slack.chat.postMessage({
        channel: settings.channel_id,
        ...message,
      })

      // 配信レコードを更新（成功）
      const { error: updateError } = await supabase
        .from('slack_daily_deliveries')
        .update({
          message_ts: result.ts,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', delivery.id)

      if (updateError) {
        console.error('Failed to update delivery record:', updateError)
      }

      console.log(
        `Successfully delivered question ${question.id} to ${settings.channel_name}`
      )

      return NextResponse.json({
        success: true,
        deliveryId: delivery.id,
        questionId: question.id,
        channel: settings.channel_name,
      })
    } catch (slackError: any) {
      console.error('Slack API error:', slackError)

      // 配信レコードを更新（失敗）
      await supabase
        .from('slack_daily_deliveries')
        .update({
          status: 'failed',
          error_message: slackError.message,
        })
        .eq('id', delivery.id)

      throw slackError
    }
  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * ランダムに問題を取得
 * 設定に基づいて難易度・カテゴリをフィルタリング
 */
async function getRandomQuestion(supabase: any, settings: any) {
  let query = supabase.from('questions').select('*').eq('is_active', true)

  // 難易度フィルタ
  if (settings.difficulty_filter && settings.difficulty_filter.length > 0) {
    query = query.in('difficulty', settings.difficulty_filter)
  }

  // カテゴリフィルタ
  if (settings.category_filter && settings.category_filter.length > 0) {
    query = query.in('category', settings.category_filter)
  }

  const { data: questions, error } = await query

  if (error) {
    console.error('Error fetching questions:', error)
    return null
  }

  if (!questions || questions.length === 0) {
    return null
  }

  // ランダムに1問選択
  const randomIndex = Math.floor(Math.random() * questions.length)
  return questions[randomIndex]
}
