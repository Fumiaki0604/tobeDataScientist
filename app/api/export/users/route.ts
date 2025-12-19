import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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

  // 全ユーザーを取得
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 各ユーザーの統計を取得
  const usersWithStats = await Promise.all(
    (users || []).map(async (userProfile) => {
      const { count: sessionCount } = await supabase
        .from('exam_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('passed, score_percentage')
        .eq('user_id', userProfile.id)

      const passedCount = sessions?.filter((s) => s.passed).length || 0
      const avgScore =
        sessions && sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) /
            sessions.length
          : 0

      return {
        ...userProfile,
        sessionCount: sessionCount || 0,
        passedCount,
        avgScore,
      }
    })
  )

  // CSV形式に変換
  const headers = [
    'ユーザーID',
    '表示名',
    'メールアドレス',
    'ロール',
    '受験回数',
    '合格回数',
    '平均点(%)',
    '登録日時',
  ]

  const csvRows = [headers.join(',')]

  usersWithStats.forEach((u) => {
    const row = [
      u.id,
      `"${u.display_name || ''}"`,
      `"${u.email || ''}"`,
      u.role === 'admin' ? '管理者' : 'ユーザー',
      u.sessionCount,
      u.passedCount,
      u.avgScore.toFixed(1),
      new Date(u.created_at).toLocaleString('ja-JP'),
    ]
    csvRows.push(row.join(','))
  })

  const csv = csvRows.join('\n')

  // UTF-8 BOM付きで返す（Excelでの文字化け防止）
  const bom = '\uFEFF'
  const csvWithBom = bom + csv

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="users_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
