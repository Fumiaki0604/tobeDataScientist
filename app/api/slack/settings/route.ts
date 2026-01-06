import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 配信設定を取得
 */
export async function GET() {
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
        { error: 'No active Slack integration' },
        { status: 404 }
      )
    }

    // 配信設定を取得
    const { data: settings, error: settingsError } = await supabase
      .from('slack_daily_delivery_settings')
      .select('*')
      .eq('workspace_id', integration.workspace_id)
      .maybeSingle()

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error in GET /api/slack/settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 配信設定を保存・更新
 */
export async function POST(request: NextRequest) {
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
        { error: 'No active Slack integration' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      channel_id,
      channel_name,
      delivery_time,
      difficulty_filter,
      category_filter,
      is_active,
    } = body

    // バリデーション
    if (!channel_id || !channel_name || !delivery_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 時刻フォーマットチェック（HH:mm）
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(delivery_time)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:mm' },
        { status: 400 }
      )
    }

    // 設定を保存（upsert）
    const { data: settings, error: upsertError } = await supabase
      .from('slack_daily_delivery_settings')
      .upsert(
        {
          workspace_id: integration.workspace_id,
          channel_id,
          channel_name,
          delivery_time,
          difficulty_filter: difficulty_filter || null,
          category_filter: category_filter || null,
          is_active: is_active !== undefined ? is_active : true,
        },
        {
          onConflict: 'workspace_id',
        }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting settings:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error in POST /api/slack/settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
