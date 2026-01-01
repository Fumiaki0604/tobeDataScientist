import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/slack/crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/slack?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code not found' },
      { status: 400 }
    )
  }

  try {
    // Slack OAuth token取得
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/oauth/callback`,
      }),
    })

    const data = await tokenResponse.json()

    if (!data.ok) {
      throw new Error(data.error || 'OAuth failed')
    }

    // トークンを暗号化
    const encryptedToken = await encryptToken(data.access_token)

    const supabase = await createClient()
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

    // DBに保存（upsert で既存レコードを更新）
    const { error: insertError } = await supabase
      .from('slack_integrations')
      .upsert(
        {
          workspace_id: data.team.id,
          workspace_name: data.team.name,
          team_name: data.team.name,
          access_token_encrypted: encryptedToken,
          bot_user_id: data.bot_user_id,
          installed_by: user.id,
          is_active: true,
          last_health_check: new Date().toISOString(),
        },
        {
          onConflict: 'workspace_id',
        }
      )

    if (insertError) {
      console.error('Database insert error:', insertError)
      throw insertError
    }

    return NextResponse.redirect(
      new URL('/admin/slack?success=true', request.url)
    )
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(
      new URL(
        `/admin/slack?error=${encodeURIComponent(error.message || 'Unknown error')}`,
        request.url
      )
    )
  }
}
