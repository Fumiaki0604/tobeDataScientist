import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // ユーザープロファイルを取得
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                データサイエンティスト試験対策
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {profile?.display_name || user.email}
              </span>
              <span className="text-sm text-gray-500">
                ({profile?.role === 'admin' ? '管理者' : 'ユーザー'})
              </span>
              <form action={handleSignOut}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ようこそ、{profile?.display_name || 'ユーザー'}さん！
              </h2>
              <p className="text-gray-600 mb-6">
                データサイエンティスト検定リテラシーレベルの試験対策を始めましょう。
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    試験を開始
                  </h3>
                  <p className="text-blue-700 text-sm mb-4">
                    問題を解いて実力を試しましょう
                  </p>
                  <Link
                    href="/exam/start"
                    className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center"
                  >
                    開始する
                  </Link>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    学習履歴
                  </h3>
                  <p className="text-green-700 text-sm mb-4">
                    過去の成績を確認できます
                  </p>
                  <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                    履歴を見る
                  </button>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">
                    カテゴリ別学習
                  </h3>
                  <p className="text-purple-700 text-sm mb-4">
                    苦手分野を集中的に学習
                  </p>
                  <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                    選択する
                  </button>
                </div>
              </div>

              {profile?.role === 'admin' && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    管理者メニュー
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Link
                      href="/admin/questions"
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                    >
                      問題管理
                    </Link>
                    <Link
                      href="/admin"
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-center"
                    >
                      管理画面
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
