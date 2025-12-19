import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QuestionsListClient from './QuestionsListClient'

export default async function QuestionsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 管理者チェック
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // 問題一覧を取得（カテゴリ情報も含める）
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  // カテゴリ一覧を取得（フィルタリング用）
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .order('display_order')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="text-gray-600 hover:text-gray-900"
              >
                ← 管理画面
              </Link>
              <h1 className="text-xl font-bold text-gray-900">問題管理</h1>
            </div>
            <div className="flex items-center">
              <Link
                href="/admin/questions/new"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                新規問題作成
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              エラー: {error.message}
            </div>
          )}

          <QuestionsListClient
            questions={questions || []}
            categories={categories || []}
          />
        </div>
      </main>
    </div>
  )
}
