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

  // 全問題とカテゴリ情報を取得
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      *,
      categories (
        name
      )
    `)
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // CSV形式に変換
  const headers = [
    'ID',
    'カテゴリ',
    '問題文',
    '選択肢1',
    '選択肢2',
    '選択肢3',
    '選択肢4',
    '正解',
    '解説',
    '難易度',
    'ソース',
    '承認済み',
    '作成日時',
  ]

  const csvRows = [headers.join(',')]

  questions?.forEach((q) => {
    const category = q.categories as any
    const row = [
      q.id,
      `"${category?.name || ''}"`,
      `"${q.question_text?.replace(/"/g, '""') || ''}"`,
      `"${q.choice1?.replace(/"/g, '""') || ''}"`,
      `"${q.choice2?.replace(/"/g, '""') || ''}"`,
      `"${q.choice3?.replace(/"/g, '""') || ''}"`,
      `"${q.choice4?.replace(/"/g, '""') || ''}"`,
      q.correct_choice,
      `"${q.explanation?.replace(/"/g, '""') || ''}"`,
      q.difficulty || '',
      q.source || '',
      q.is_approved ? 'はい' : 'いいえ',
      new Date(q.created_at).toLocaleString('ja-JP'),
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
      'Content-Disposition': `attachment; filename="questions_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
