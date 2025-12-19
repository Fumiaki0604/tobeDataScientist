import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CategoriesPage() {
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

  // カテゴリ一覧を取得（親カテゴリと子カテゴリの両方）
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('display_order', { ascending: true })

  // 親カテゴリと子カテゴリに分類
  const parentCategories = categories?.filter((cat) => cat.parent_id === null) || []
  const childCategories = categories?.filter((cat) => cat.parent_id !== null) || []

  // 各親カテゴリに紐づく子カテゴリを取得
  const getCategoryChildren = (parentId: number) => {
    return childCategories.filter((cat) => cat.parent_id === parentId)
  }

  // カテゴリごとの問題数を取得
  const { data: questionCounts } = await supabase
    .from('questions')
    .select('category_id')

  const getQuestionCount = (categoryId: number) => {
    return questionCounts?.filter((q) => q.category_id === categoryId).length || 0
  }

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
              <h1 className="text-xl font-bold text-gray-900">カテゴリ管理</h1>
            </div>
            <div className="flex items-center">
              <Link
                href="/admin/categories/new"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                新規カテゴリ作成
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

          {!categories || categories.length === 0 ? (
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                カテゴリがありません
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                新しいカテゴリを作成してください
              </p>
              <div className="mt-6">
                <Link
                  href="/admin/categories/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  新規カテゴリ作成
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 親カテゴリごとに表示 */}
              {parentCategories.map((parent) => {
                const children = getCategoryChildren(parent.id)
                const parentQuestionCount = getQuestionCount(parent.id)
                const childrenQuestionCount = children.reduce(
                  (sum, child) => sum + getQuestionCount(child.id),
                  0
                )
                const totalQuestionCount = parentQuestionCount + childrenQuestionCount

                return (
                  <div
                    key={parent.id}
                    className="bg-white shadow rounded-lg overflow-hidden"
                  >
                    {/* 親カテゴリヘッダー */}
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h2 className="text-lg font-semibold text-indigo-900">
                            {parent.name}
                          </h2>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            親カテゴリ
                          </span>
                          <span className="text-sm text-indigo-600">
                            問題数: {totalQuestionCount}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Link
                            href={`/admin/categories/${parent.id}`}
                            className="px-3 py-1 text-sm border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-100"
                          >
                            編集
                          </Link>
                        </div>
                      </div>
                      {parent.description && (
                        <p className="mt-2 text-sm text-indigo-700">
                          {parent.description}
                        </p>
                      )}
                    </div>

                    {/* 子カテゴリリスト */}
                    {children.length > 0 && (
                      <div className="divide-y divide-gray-200">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="px-6 py-4 hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <span className="text-gray-400">└</span>
                                  <h3 className="text-sm font-medium text-gray-900">
                                    {child.name}
                                  </h3>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                    表示順: {child.display_order}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    問題数: {getQuestionCount(child.id)}
                                  </span>
                                </div>
                                {child.description && (
                                  <p className="mt-1 ml-6 text-sm text-gray-500">
                                    {child.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex space-x-2 ml-4">
                                <Link
                                  href={`/admin/categories/${child.id}`}
                                  className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                                >
                                  編集
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 子カテゴリがない場合 */}
                    {children.length === 0 && (
                      <div className="px-6 py-4 text-center text-sm text-gray-500">
                        子カテゴリがありません
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 親カテゴリのない子カテゴリ（孤立カテゴリ） */}
              {childCategories.some((cat) => !parentCategories.find((p) => p.id === cat.parent_id)) && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-100">
                    <h2 className="text-lg font-semibold text-yellow-900">
                      未分類のカテゴリ
                    </h2>
                    <p className="mt-1 text-sm text-yellow-700">
                      親カテゴリが存在しないカテゴリです
                    </p>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {childCategories
                      .filter((cat) => !parentCategories.find((p) => p.id === cat.parent_id))
                      .map((child) => (
                        <div
                          key={child.id}
                          className="px-6 py-4 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <h3 className="text-sm font-medium text-gray-900">
                                  {child.name}
                                </h3>
                                <span className="text-sm text-gray-500">
                                  問題数: {getQuestionCount(child.id)}
                                </span>
                              </div>
                              {child.description && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {child.description}
                                </p>
                              )}
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <Link
                                href={`/admin/categories/${child.id}`}
                                className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                              >
                                編集
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
