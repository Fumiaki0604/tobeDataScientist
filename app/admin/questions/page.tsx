import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

          {!questions || questions.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                問題がありません
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                新しい問題を作成してください
              </p>
              <div className="mt-6">
                <Link
                  href="/admin/questions/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  新規問題作成
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {questions.map((question: any) => (
                  <li key={question.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              問題 #{question.id}
                            </p>
                            {question.categories && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {question.categories.name}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              難易度: {question.difficulty}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {question.source === 'ai_generated' ? 'AI生成' : '手動作成'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-900">
                            {question.question_text}
                          </p>
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span>
                              作成日:{' '}
                              {new Date(question.created_at).toLocaleDateString(
                                'ja-JP'
                              )}
                            </span>
                            <span className="mx-2">•</span>
                            <span>ソース: {question.source}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/admin/questions/${question.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            編集
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
