import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ExamResultPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const sessionId = parseInt(params.sessionId)

  // セッション情報を取得
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    redirect('/dashboard')
  }

  // まだ終了していない場合は試験画面へ
  if (!session.end_time) {
    redirect(`/exam/${sessionId}`)
  }

  // 回答詳細を取得
  const { data: answers } = await supabase
    .from('exam_answers')
    .select(`
      *,
      questions (
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        categories (
          id,
          name
        )
      )
    `)
    .eq('exam_session_id', sessionId)
    .order('id')

  // カテゴリ別の正答率を計算
  const categoryStats: { [key: string]: { correct: number; total: number } } =
    {}

  answers?.forEach((answer) => {
    const categoryName =
      answer.questions?.categories?.name || 'カテゴリなし'
    if (!categoryStats[categoryName]) {
      categoryStats[categoryName] = { correct: 0, total: 0 }
    }
    categoryStats[categoryName].total++
    if (answer.is_correct) {
      categoryStats[categoryName].correct++
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">試験結果</h1>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ダッシュボードへ
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* スコアカード */}
          <div className="bg-white shadow rounded-lg p-8 mb-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {session.passed ? '🎉 合格です！' : '不合格'}
              </h2>
              <div className="flex justify-center items-baseline space-x-2 mb-2">
                <span className="text-6xl font-bold text-indigo-600">
                  {session.score_percentage?.toFixed(1)}
                </span>
                <span className="text-2xl text-gray-500">%</span>
              </div>
              <p className="text-gray-600 mb-6">
                {session.correct_answers} / {session.total_questions} 問正解
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/exam/start"
                  className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  もう一度挑戦
                </Link>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  ダッシュボードへ
                </Link>
              </div>
            </div>
          </div>

          {/* カテゴリ別正答率 */}
          {Object.keys(categoryStats).length > 1 && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                カテゴリ別正答率
              </h3>
              <div className="space-y-4">
                {Object.entries(categoryStats).map(
                  ([category, stats]) => {
                    const percentage = (stats.correct / stats.total) * 100
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">
                            {category}
                          </span>
                          <span className="text-gray-600">
                            {stats.correct} / {stats.total} (
                            {percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              percentage >= 70
                                ? 'bg-green-500'
                                : percentage >= 50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          )}

          {/* 問題ごとの詳細 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              解答と解説
            </h3>
            <div className="space-y-6">
              {answers?.map((answer, index) => {
                const question = answer.questions
                if (!question) return null

                return (
                  <div
                    key={answer.id}
                    className={`border-l-4 pl-4 ${
                      answer.is_correct
                        ? 'border-green-500'
                        : 'border-red-500'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-700">
                        問題 {index + 1}
                      </span>
                      {question.categories && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {question.categories.name}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          answer.is_correct
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {answer.is_correct ? '正解' : '不正解'}
                      </span>
                    </div>

                    <p className="text-gray-900 mb-3">
                      {question.question_text}
                    </p>

                    <div className="space-y-2 mb-3">
                      {['a', 'b', 'c', 'd'].map((option) => {
                        const isUserAnswer = answer.user_answer === option
                        const isCorrectAnswer =
                          question.correct_answer === option

                        return (
                          <div
                            key={option}
                            className={`p-3 rounded-md ${
                              isCorrectAnswer
                                ? 'bg-green-50 border border-green-300'
                                : isUserAnswer
                                ? 'bg-red-50 border border-red-300'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start">
                              <span className="font-bold text-gray-700 mr-2">
                                {option.toUpperCase()}.
                              </span>
                              <span className="flex-1">
                                {question[`option_${option}` as keyof typeof question] as string}
                              </span>
                              {isCorrectAnswer && (
                                <span className="text-green-600 font-semibold ml-2">
                                  ✓ 正解
                                </span>
                              )}
                              {isUserAnswer && !isCorrectAnswer && (
                                <span className="text-red-600 font-semibold ml-2">
                                  あなたの回答
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {question.explanation && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <h4 className="font-semibold text-blue-900 mb-2">
                          解説
                        </h4>
                        <p className="text-blue-800 text-sm">
                          {question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
