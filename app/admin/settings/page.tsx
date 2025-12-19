'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    default_question_count: 20,
    passing_score: 70,
    time_limit_minutes: 60,
    allow_category_selection: true,
    show_explanations: true,
  })

  useEffect(() => {
    checkAdminAccess()
    fetchSettings()
  }, [])

  const checkAdminAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/dashboard')
    }
  }

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('exam_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      setFormData({
        default_question_count: data.default_question_count || 20,
        passing_score: data.passing_score || 70,
        time_limit_minutes: data.time_limit_minutes || 60,
        allow_category_selection: data.allow_category_selection ?? true,
        show_explanations: data.show_explanations ?? true,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      // 設定レコードが存在するか確認
      const { data: existing } = await supabase
        .from('exam_settings')
        .select('id')
        .eq('id', 1)
        .single()

      if (existing) {
        // 更新
        const { error: updateError } = await supabase
          .from('exam_settings')
          .update({
            default_question_count: formData.default_question_count,
            passing_score: formData.passing_score,
            time_limit_minutes: formData.time_limit_minutes,
            allow_category_selection: formData.allow_category_selection,
            show_explanations: formData.show_explanations,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1)

        if (updateError) throw updateError
      } else {
        // 新規作成
        const { error: insertError } = await supabase
          .from('exam_settings')
          .insert({
            id: 1,
            default_question_count: formData.default_question_count,
            passing_score: formData.passing_score,
            time_limit_minutes: formData.time_limit_minutes,
            allow_category_selection: formData.allow_category_selection,
            show_explanations: formData.show_explanations,
          })

        if (insertError) throw insertError
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || '設定の保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                ← 管理画面
              </Link>
              <h1 className="text-xl font-bold text-gray-900">試験設定</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    基本設定
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    試験のデフォルト設定を管理します
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6">
                      <label
                        htmlFor="default_question_count"
                        className="block text-sm font-medium text-gray-700"
                      >
                        デフォルト出題数
                      </label>
                      <input
                        type="number"
                        id="default_question_count"
                        min="1"
                        max="100"
                        value={formData.default_question_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            default_question_count: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        試験開始時のデフォルト問題数（1-100）
                      </p>
                    </div>

                    <div className="col-span-6">
                      <label
                        htmlFor="passing_score"
                        className="block text-sm font-medium text-gray-700"
                      >
                        合格点（%）
                      </label>
                      <input
                        type="number"
                        id="passing_score"
                        min="0"
                        max="100"
                        value={formData.passing_score}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            passing_score: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        合格と判定する正答率（0-100%）
                      </p>
                    </div>

                    <div className="col-span-6">
                      <label
                        htmlFor="time_limit_minutes"
                        className="block text-sm font-medium text-gray-700"
                      >
                        制限時間（分）
                      </label>
                      <input
                        type="number"
                        id="time_limit_minutes"
                        min="0"
                        max="300"
                        value={formData.time_limit_minutes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            time_limit_minutes: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        試験の制限時間（0で無制限、最大300分）
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    機能設定
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    試験機能の有効/無効を管理します
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="space-y-6">
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="allow_category_selection"
                          type="checkbox"
                          checked={formData.allow_category_selection}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              allow_category_selection: e.target.checked,
                            })
                          }
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor="allow_category_selection"
                          className="font-medium text-gray-700"
                        >
                          カテゴリ選択を許可
                        </label>
                        <p className="text-gray-500">
                          ユーザーが試験開始時にカテゴリを選択できるようにします
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="show_explanations"
                          type="checkbox"
                          checked={formData.show_explanations}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              show_explanations: e.target.checked,
                            })
                          }
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label
                          htmlFor="show_explanations"
                          className="font-medium text-gray-700"
                        >
                          解説を表示
                        </label>
                        <p className="text-gray-500">
                          試験結果画面で問題の解説を表示します
                        </p>
                      </div>
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

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      設定を保存しました
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Link
                href="/admin"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? '保存中...' : '設定を保存'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
