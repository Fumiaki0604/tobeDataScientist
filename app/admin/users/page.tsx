import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function UsersPage() {
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

  // 全ユーザーを取得
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 各ユーザーの試験セッション数を取得
  const usersWithStats = await Promise.all(
    (users || []).map(async (userProfile) => {
      const { count: sessionCount } = await supabase
        .from('exam_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userProfile.id)

      const { data: sessions } = await supabase
        .from('exam_sessions')
        .select('passed')
        .eq('user_id', userProfile.id)

      const passedCount = sessions?.filter((s) => s.passed).length || 0

      return {
        ...userProfile,
        sessionCount: sessionCount || 0,
        passedCount,
      }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                ← 管理画面
              </Link>
              <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 統計情報 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-gray-500">総ユーザー数</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {users?.length || 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">管理者数</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {users?.filter((u) => u.role === 'admin').length || 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">一般ユーザー数</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {users?.filter((u) => u.role === 'user').length || 0}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              エラー: {error.message}
            </div>
          )}

          {/* ユーザー一覧 */}
          {!users || users.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                ユーザーがいません
              </h3>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {usersWithStats.map((userProfile) => (
                  <li key={userProfile.id}>
                    <Link
                      href={`/admin/users/${userProfile.id}`}
                      className="block hover:bg-gray-50"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                              <p className="text-sm font-medium text-indigo-600 truncate">
                                {userProfile.display_name || 'ユーザー名未設定'}
                              </p>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  userProfile.role === 'admin'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {userProfile.role === 'admin' ? '管理者' : 'ユーザー'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span className="truncate">
                                {userProfile.email || 'メールアドレス未設定'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                              <span>受験回数: {userProfile.sessionCount}回</span>
                              <span>合格回数: {userProfile.passedCount}回</span>
                              <span>
                                登録日:{' '}
                                {new Date(userProfile.created_at).toLocaleDateString(
                                  'ja-JP'
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
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
