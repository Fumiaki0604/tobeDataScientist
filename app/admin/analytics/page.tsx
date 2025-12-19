import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AnalyticsPage() {
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

  // 全体統計
  const { count: totalSessions } = await supabase
    .from('exam_sessions')
    .select('*', { count: 'exact', head: true })

  const { data: allSessions } = await supabase
    .from('exam_sessions')
    .select('passed, score_percentage')

  const passedSessions = allSessions?.filter((s) => s.passed).length || 0
  const passRate = totalSessions ? (passedSessions / totalSessions) * 100 : 0
  const averageScore =
    allSessions && allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) /
        allSessions.length
      : 0

  // カテゴリ別統計
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  const categoryStats = await Promise.all(
    (categories || []).map(async (category) => {
      // カテゴリに紐づく問題のIDを取得
      const { data: questions } = await supabase
        .from('questions')
        .select('id')
        .eq('category_id', category.id)
        .eq('is_approved', true)

      const questionIds = questions?.map((q) => q.id) || []

      if (questionIds.length === 0) {
        return {
          category: category.name,
          totalAnswers: 0,
          correctAnswers: 0,
          accuracy: 0,
        }
      }

      // 該当する回答を取得
      const { data: answers } = await supabase
        .from('user_answers')
        .select('is_correct')
        .in('question_id', questionIds)

      const totalAnswers = answers?.length || 0
      const correctAnswers = answers?.filter((a) => a.is_correct).length || 0
      const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0

      return {
        category: category.name,
        totalAnswers,
        correctAnswers,
        accuracy,
      }
    })
  )

  // 正答率で降順ソート
  categoryStats.sort((a, b) => b.accuracy - a.accuracy)

  // 最近の試験活動
  const { data: recentSessions } = await supabase
    .from('exam_sessions')
    .select(`
      *,
      user_profiles (
        display_name,
        email
      )
    `)
    .order('start_time', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                ← 管理画面
              </Link>
              <h1 className="text-xl font-bold text-gray-900">分析・レポート</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 全体統計カード */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        総受験回数
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {totalSessions || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        合格率
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {passRate.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        平均点
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {averageScore.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* カテゴリ別正答率 */}
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                カテゴリ別正答率
              </h2>
              {categoryStats.length === 0 ? (
                <p className="text-sm text-gray-500">データがありません</p>
              ) : (
                <div className="space-y-4">
                  {categoryStats.map((stat, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {stat.category}
                        </span>
                        <span className="text-sm text-gray-500">
                          {stat.correctAnswers} / {stat.totalAnswers} 問正解（
                          {stat.accuracy.toFixed(1)}%）
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            stat.accuracy >= 70
                              ? 'bg-green-600'
                              : stat.accuracy >= 50
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${stat.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 最近の試験活動 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                最近の試験活動
              </h2>
              {!recentSessions || recentSessions.length === 0 ? (
                <p className="text-sm text-gray-500">データがありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ユーザー
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          受験日時
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          得点
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          結果
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentSessions.map((session) => {
                        const userProfile = session.user_profiles as any
                        return (
                          <tr key={session.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {userProfile?.display_name || userProfile?.email || '不明'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(session.start_time).toLocaleString('ja-JP')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {session.score_percentage?.toFixed(1)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  session.passed
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {session.passed ? '合格' : '不合格'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
