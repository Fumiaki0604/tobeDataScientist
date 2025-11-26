'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Category = {
  id: number
  name: string
  description: string | null
}

type Props = {
  categories: Category[]
  defaultQuestionCount: number
  totalQuestions: number
}

export default function ExamStartForm({
  categories,
  defaultQuestionCount,
  totalQuestions,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [questionCount, setQuestionCount] = useState(defaultQuestionCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('認証が必要です')
      }

      // 試験セッションを作成
      const { data: session, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert({
          user_id: user.id,
          total_questions: questionCount,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // 問題をランダムに取得
      let query = supabase
        .from('questions')
        .select('id')
        .eq('is_approved', true)

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      const { data: allQuestions, error: questionsError } = await query

      if (questionsError) throw questionsError

      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('該当する問題が見つかりません')
      }

      if (allQuestions.length < questionCount) {
        throw new Error(
          `選択されたカテゴリには${allQuestions.length}問しかありません。出題数を減らしてください。`
        )
      }

      // ランダムにシャッフルして指定数取得
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, questionCount)

      // exam_answersに初期レコードを作成（回答前の状態）
      const answerRecords = selectedQuestions.map((q, index) => ({
        exam_session_id: session.id,
        question_id: q.id,
        user_answer: 'a', // 仮の値（後で更新）
        is_correct: false, // 仮の値（後で更新）
        question_order: index + 1,
      }))

      const { error: answersError } = await supabase
        .from('exam_answers')
        .insert(answerRecords)

      if (answersError) throw answersError

      // 試験画面へ遷移
      router.push(`/exam/${session.id}`)
    } catch (err: any) {
      setError(err.message || '試験の開始に失敗しました')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* カテゴリ選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          カテゴリ選択
        </label>
        <div className="space-y-2">
          <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="category"
              value="all"
              checked={selectedCategory === null}
              onChange={() => setSelectedCategory(null)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">全カテゴリ</p>
              <p className="text-sm text-gray-500">
                すべてのカテゴリからランダムに出題
              </p>
            </div>
          </label>

          {categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="category"
                value={category.id}
                checked={selectedCategory === category.id}
                onChange={() => setSelectedCategory(category.id)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {category.name}
                </p>
                {category.description && (
                  <p className="text-sm text-gray-500">{category.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 出題数選択 */}
      <div>
        <label
          htmlFor="questionCount"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          出題数: {questionCount}問
        </label>
        <input
          type="range"
          id="questionCount"
          min="5"
          max={Math.min(100, totalQuestions)}
          step="5"
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5問</span>
          <span>{Math.min(100, totalQuestions)}問</span>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 送信ボタン */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '開始中...' : '試験を開始する'}
        </button>
      </div>
    </form>
  )
}
