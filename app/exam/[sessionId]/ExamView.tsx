'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Question = {
  id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string
  categories: { name: string } | null
}

type Answer = {
  id: number
  exam_session_id: number
  question_id: number
  user_answer: string
  is_correct: boolean
  questions: Question
}

type Props = {
  sessionId: number
  totalQuestions: number
  answers: Answer[]
}

export default function ExamView({ sessionId, totalQuestions, answers }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>(
    // 既存の回答があれば復元（途中で離脱した場合など）
    answers.reduce((acc, answer) => {
      acc[answer.id] = answer.user_answer
      return acc
    }, {} as { [key: number]: string })
  )
  const [submitting, setSubmitting] = useState(false)

  const currentAnswer = answers[currentIndex]
  const currentQuestion = currentAnswer.questions

  const handleAnswerSelect = (answer: string) => {
    setUserAnswers({
      ...userAnswers,
      [currentAnswer.id]: answer,
    })
  }

  const handleNext = () => {
    if (currentIndex < answers.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    // 未回答チェック
    const unanswered = answers.filter(
      (answer) => !userAnswers[answer.id] || userAnswers[answer.id] === ''
    )

    if (unanswered.length > 0) {
      if (
        !confirm(
          `${unanswered.length}問未回答です。このまま提出しますか？`
        )
      ) {
        return
      }
    }

    setSubmitting(true)

    try {
      // 各回答を更新
      const updates = answers.map((answer) => {
        const selectedAnswer = userAnswers[answer.id] || 'a'
        const isCorrect =
          selectedAnswer === answer.questions.correct_answer

        return supabase
          .from('exam_answers')
          .update({
            user_answer: selectedAnswer,
            is_correct: isCorrect,
          })
          .eq('id', answer.id)
      })

      await Promise.all(updates)

      // 正答数を集計
      const correctCount = answers.filter(
        (answer) => userAnswers[answer.id] === answer.questions.correct_answer
      ).length

      const scorePercentage = (correctCount / totalQuestions) * 100

      // 試験設定から合格ラインを取得
      const { data: settings } = await supabase
        .from('exam_settings')
        .select('passing_score')
        .order('id', { ascending: false })
        .limit(1)
        .single()

      const passingScore = settings?.passing_score || 70
      const passed = scorePercentage >= passingScore

      // セッションを更新
      await supabase
        .from('exam_sessions')
        .update({
          end_time: new Date().toISOString(),
          correct_answers: correctCount,
          score_percentage: scorePercentage,
          passed,
        })
        .eq('id', sessionId)

      // 結果画面へ遷移
      router.push(`/exam/${sessionId}/result`)
    } catch (error) {
      console.error('Error submitting exam:', error)
      alert('試験の提出に失敗しました')
      setSubmitting(false)
    }
  }

  const answeredCount = Object.keys(userAnswers).filter(
    (key) => userAnswers[parseInt(key)] && userAnswers[parseInt(key)] !== ''
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">試験中</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                回答済み: {answeredCount} / {totalQuestions}
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提出中...' : '試験を提出'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 進捗バー */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                問題 {currentIndex + 1} / {totalQuestions}
              </span>
              <span>
                {Math.round(((currentIndex + 1) / totalQuestions) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{
                  width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* 問題カード */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            {currentQuestion.categories && (
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {currentQuestion.categories.name}
                </span>
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3">
              {['a', 'b', 'c', 'd'].map((option) => (
                <label
                  key={option}
                  className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    userAnswers[currentAnswer.id] === option
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option}
                    checked={userAnswers[currentAnswer.id] === option}
                    onChange={() => handleAnswerSelect(option)}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="ml-3 flex-1">
                    <span className="inline-block w-6 font-bold text-gray-700">
                      {option.toUpperCase()}.
                    </span>
                    <span className="text-gray-900">
                      {currentQuestion[`option_${option}` as keyof Question] as string}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← 前の問題
            </button>

            {currentIndex === answers.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提出中...' : '試験を提出'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                次の問題 →
              </button>
            )}
          </div>

          {/* 問題一覧（クイックナビゲーション） */}
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              問題一覧
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {answers.map((answer, index) => (
                <button
                  key={answer.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`p-2 text-sm font-medium rounded-md ${
                    currentIndex === index
                      ? 'bg-indigo-600 text-white'
                      : userAnswers[answer.id]
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
