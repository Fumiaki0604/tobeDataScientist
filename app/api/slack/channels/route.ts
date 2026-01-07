import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'
import { decryptToken } from '@/lib/slack/crypto'

export const dynamic = 'force-dynamic'

/**
 * Slackチャンネル一覧を取得
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

    // Slack Botトークンを復号化
    const botToken = await decryptToken(integration.access_token_encrypted)
    const slack = new WebClient(botToken)

    // チャンネル一覧を取得（ページネーション対応、レート制限考慮）
    const allChannels: any[] = []
    let cursor: string | undefined = undefined
    let pageCount = 0
    const maxPages = 10 // 最大10ページ（2000チャンネル）まで取得

    do {
      const result = await slack.conversations.list({
        exclude_archived: true,
        types: 'public_channel,private_channel',
        limit: 200,
        cursor,
      })

      if (result.channels) {
        allChannels.push(...result.channels)
      }

      cursor = result.response_metadata?.next_cursor
      pageCount++

      // 次のページがある場合は1秒待機（レート制限回避）
      if (cursor && pageCount < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } while (cursor && pageCount < maxPages)

    // デバッグ: 全チャンネル数とsato_investの存在確認
    console.log('Total channels fetched:', allChannels.length)
    const satoInvest = allChannels.find((ch: any) => ch.name === 'sato_invest')
    if (satoInvest) {
      console.log('sato_invest found:', {
        name: satoInvest.name,
        is_member: satoInvest.is_member,
        is_private: satoInvest.is_private,
      })
    } else {
      console.log('sato_invest NOT FOUND in fetched channels')
    }

    // Botが参加しているチャンネルのみフィルタ
    const channels = allChannels
      .filter((channel: any) => channel.is_member)
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_member: channel.is_member,
      }))

    console.log('Filtered member channels:', channels.length)

    return NextResponse.json({ channels })
  } catch (error: any) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}
