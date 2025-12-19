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

  // 全試験セッションとユーザー情報を取得
  const { data: sessions, error } = await supabase
    .from('exam_sessions')
    .select(`
      *,
      user_profiles (
        display_name,
        email
      )
    `)
    .order('start_time', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // CSV形式に変換
  const headers = [
    'セッションID',
    'ユーザー名',
    'メールアドレス',
    '開始日時',
    '終了日時',
    '総問題数',
    '正解数',
    '得点率(%)',
    '合格/不合格',
  ]

  const csvRows = [headers.join(',')]

  sessions?.forEach((s) => {
    const userProfile = s.user_profiles as any
    const row = [
      s.id,
      `"${userProfile?.display_name || ''}"`,
      `"${userProfile?.email || ''}"`,
      new Date(s.start_time).toLocaleString('ja-JP'),
      s.end_time ? new Date(s.end_time).toLocaleString('ja-JP') : '',
      s.total_questions,
      s.correct_answers || 0,
      s.score_percentage?.toFixed(1) || '0.0',
      s.passed ? '合格' : '不合格',
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
      'Content-Disposition': `attachment; filename="exam_sessions_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
