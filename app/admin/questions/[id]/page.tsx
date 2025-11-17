'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditQuestionPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const questionId = params.id as string

  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [formData, setFormData] = useState({
    category_id: '',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a' as 'a' | 'b' | 'c' | 'd',
    explanation: '',
    difficulty: 3,
    is_approved: true,
  })

  useEffect(() => {
    fetchCategories()
    fetchQuestion()
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('display_order')

    if (data) {
      setCategories(data)
    }
  }

  const fetchQuestion = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (error || !data) {
      setNotFound(true)
      return
    }

    setFormData({
      category_id: data.category_id?.toString() || '',
      question_text: data.question_text || '',
      option_a: data.option_a || '',
      option_b: data.option_b || '',
      option_c: data.option_c || '',
      option_d: data.option_d || '',
      correct_answer: data.correct_answer || 'a',
      explanation: data.explanation || '',
      difficulty: data.difficulty || 3,
      is_approved: data.is_approved !== false,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          ...formData,
          category_id: formData.category_id ? parseInt(formData.category_id) : null,
        })
        .eq('id', questionId)

      if (updateError) throw updateError

      router.push('/admin/questions')
      router.refresh()
    } catch (err: any) {
      setError(err.message || '問題の更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('この問題を削除してもよろしいですか？')) {
      return
    }

    setLoading(true)
    try {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (deleteError) throw deleteError

      router.push('/admin/questions')
      router.refresh()
    } catch (err: any) {
      setError(err.message || '問題の削除に失敗しました')
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            問題が見つかりません
          </h1>
          <Link
            href="/admin/questions"
            className="text-indigo-600 hover:text-indigo-500"
          >
            ← 問題一覧に戻る
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
                href="/admin/questions"
                className="text-gray-600 hover:text-gray-900"
              >
                ← 問題一覧
              </Link>
              <h1 className="text-xl font-bold text-gray-900">問題編集</h1>
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
                    問題情報
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    問題の基本情報を編集してください
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6">
                      <label
                        htmlFor="category"
                        className="block text-sm font-medium text-gray-700"
                      >
                        カテゴリ
                      </label>
                      <select
                        id="category"
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData({ ...formData, category_id: e.target.value })
                        }
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      >
                        <option value="">カテゴリを選択</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label
                        htmlFor="difficulty"
                        className="block text-sm font-medium text-gray-700"
                      >
                        難易度 (1-5)
                      </label>
                      <input
                        type="number"
                        id="difficulty"
                        min="1"
                        max="5"
                        value={formData.difficulty}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            difficulty: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_approved}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_approved: e.target.checked,
                            })
                          }
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          承認済み
                        </span>
                      </label>
                    </div>

                    <div className="col-span-6">
                      <label
                        htmlFor="question"
                        className="block text-sm font-medium text-gray-700"
                      >
                        問題文 *
                      </label>
                      <textarea
                        id="question"
                        rows={4}
                        required
                        value={formData.question_text}
                        onChange={(e) =>
                          setFormData({ ...formData, question_text: e.target.value })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="問題文を入力してください"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    選択肢
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    4つの選択肢と正解を設定してください
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="space-y-4">
                    {(['a', 'b', 'c', 'd'] as const).map((option) => (
                      <div key={option} className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="correct_answer"
                          value={option}
                          checked={formData.correct_answer === option}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              correct_answer: e.target.value as 'a' | 'b' | 'c' | 'd',
                            })
                          }
                          className="mt-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700">
                            選択肢 {option.toUpperCase()} *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData[`option_${option}` as keyof typeof formData] as string}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [`option_${option}`]: e.target.value,
                              })
                            }
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder={`選択肢${option.toUpperCase()}を入力`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    解説
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    正解の解説を入力してください
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <textarea
                    rows={6}
                    value={formData.explanation}
                    onChange={(e) =>
                      setFormData({ ...formData, explanation: e.target.value })
                    }
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="解説を入力してください（任意）"
                  />
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
                削除
              </button>
              <div className="flex space-x-3">
                <Link
                  href="/admin/questions"
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
      </main>
    </div>
  )
}
