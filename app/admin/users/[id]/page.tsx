'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const userId = params.id as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    passed: 0,
    averageScore: 0,
  })
  const [recentSessions, setRecentSessions] = useState<any[]>([])

  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    role: 'user' as 'user' | 'admin',
  })

  useEffect(() => {
    fetchUserData()
    fetchSessionStats()
    fetchRecentSessions()
  }, [])

  const fetchUserData = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) {
      setNotFound(true)
      return
    }

    setFormData({
      display_name: data.display_name || '',
      email: data.email || '',
      role: data.role || 'user',
    })
  }

  const fetchSessionStats = async () => {
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', userId)

    if (sessions) {
      const total = sessions.length
      const passed = sessions.filter((s) => s.passed).length
      const averageScore =
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) /
            sessions.length
          : 0

      setSessionStats({ total, passed, averageScore })
    }
  }

  const fetchRecentSessions = async () => {
    const { data } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(5)

    if (data) {
      setRecentSessions(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          display_name: formData.display_name,
          role: formData.role,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      router.push('/admin/users')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'ユーザー情報の更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        'このユーザーを削除してもよろしいですか？\n関連する試験データもすべて削除されます。'
      )
    ) {
      return
    }

    setLoading(true)
    try {
      // 試験セッションを削除
      await supabase.from('exam_sessions').delete().eq('user_id', userId)

      // ユーザープロファイルを削除
      const { error: deleteError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (deleteError) throw deleteError

      router.push('/admin/users')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'ユーザーの削除に失敗しました')
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            ユーザーが見つかりません
          </h1>
          <Link
            href="/admin/users"
            className="text-indigo-600 hover:text-indigo-500"
          >
            ← ユーザー一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/users"
                className="text-gray-600 hover:text-gray-900"
              >
                ← ユーザー一覧
              </Link>
              <h1 className="text-xl font-bold text-gray-900">ユーザー詳細</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 左カラム: 統計情報 */}
            <div className="lg:col-span-1 space-y-6">
              {/* 統計カード */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  試験統計
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">受験回数</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">
                      {sessionStats.total}回
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">合格回数</p>
                    <p className="mt-1 text-2xl font-semibold text-green-600">
                      {sessionStats.passed}回
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">平均点</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-600">
                      {sessionStats.averageScore.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* 最近の試験 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  最近の試験
                </h3>
                {recentSessions.length === 0 ? (
                  <p className="text-sm text-gray-500">試験履歴がありません</p>
                ) : (
                  <ul className="space-y-3">
                    {recentSessions.map((session) => (
                      <li
                        key={session.id}
                        className="text-sm border-l-4 pl-3 py-2"
                        style={{
                          borderColor: session.passed ? '#10b981' : '#ef4444',
                        }}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {session.score_percentage?.toFixed(1)}%
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              session.passed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {session.passed ? '合格' : '不合格'}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {new Date(session.start_time).toLocaleDateString('ja-JP')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 右カラム: ユーザー情報編集 */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                  <div className="md:grid md:grid-cols-3 md:gap-6">
                    <div className="md:col-span-1">
                      <h3 className="text-lg font-medium leading-6 text-gray-900">
                        ユーザー情報
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        ユーザーの基本情報を編集できます
                      </p>
                    </div>
                    <div className="mt-5 md:mt-0 md:col-span-2">
                      <div className="grid grid-cols-6 gap-6">
                        <div className="col-span-6">
                          <label
                            htmlFor="display_name"
                            className="block text-sm font-medium text-gray-700"
                          >
                            表示名
                          </label>
                          <input
                            type="text"
                            id="display_name"
                            value={formData.display_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                display_name: e.target.value,
                              })
                            }
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div className="col-span-6">
                          <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700"
                          >
                            メールアドレス
                          </label>
                          <input
                            type="email"
                            id="email"
                            value={formData.email}
                            disabled
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-500 sm:text-sm"
                          />
                          <p className="mt-2 text-sm text-gray-500">
                            メールアドレスは変更できません
                          </p>
                        </div>

                        <div className="col-span-6">
                          <label
                            htmlFor="role"
                            className="block text-sm font-medium text-gray-700"
                          >
                            ロール
                          </label>
                          <select
                            id="role"
                            value={formData.role}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                role: e.target.value as 'user' | 'admin',
                              })
                            }
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="user">ユーザー</option>
                            <option value="admin">管理者</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    ユーザーを削除
                  </button>
                  <div className="flex space-x-3">
                    <Link
                      href="/admin/users"
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      キャンセル
                    </Link>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {loading ? '更新中...' : '更新'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
