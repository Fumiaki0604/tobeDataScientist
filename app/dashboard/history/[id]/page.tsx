import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // セッション情報を取得
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    redirect('/dashboard/history')
  }

  // セッションの回答を取得（問題情報も含める）
  const { data: answers, error: answersError } = await supabase
    .from('user_answers')
    .select(`
      *,
      questions (
        id,
        question_text,
        correct_choice,
        explanation,
        choice1,
        choice2,
        choice3,
        choice4,
        categories (
          id,
          name
        )
      )
    `)
    .eq('session_id', id)
    .order('question_order')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/history" className="text-gray-600 hover:text-gray-900">
                ← 学習履歴
              </Link>
              <h1 className="text-xl font-bold text-gray-900">試験詳細</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* セッション情報カード */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-gray-500">試験日時</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {new Date(session.start_time).toLocaleString('ja-JP')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">得点</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {session.score_percentage?.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">正解数</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {session.correct_answers} / {session.total_questions}問
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">結果</p>
                <p
                  className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    session.passed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {session.passed ? '合格' : '不合格'}
                </p>
              </div>
            </div>
          </div>

          {/* 問題と回答の一覧 */}
          {answersError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              エラー: {answersError.message}
            </div>
          )}

          <div className="space-y-6">
            {answers?.map((answer, index) => {
              const question = answer.questions as any
              const isCorrect = answer.selected_choice === question.correct_choice
              const choices = [
                question.choice1,
                question.choice2,
                question.choice3,
                question.choice4,
              ]

              return (
                <div
                  key={answer.id}
                  className={`bg-white shadow rounded-lg p-6 border-l-4 ${
                    isCorrect ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  {/* 問題ヘッダー */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-700">
                        問題 {index + 1}
                      </span>
                      {question.categories && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {question.categories.name}
                        </span>
                      )}
                    </div>
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        isCorrect
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isCorrect ? '正解' : '不正解'}
                    </div>
                  </div>

                  {/* 問題文 */}
                  <div className="mb-4">
                    <p className="text-gray-900 font-medium">{question.question_text}</p>
                  </div>

                  {/* 選択肢 */}
                  <div className="space-y-2 mb-4">
                    {choices.map((choice, choiceIndex) => {
                      const choiceNumber = choiceIndex + 1
                      const isUserChoice = answer.selected_choice === choiceNumber
                      const isCorrectChoice = question.correct_choice === choiceNumber

                      return (
                        <div
                          key={choiceIndex}
                          className={`p-3 rounded-md border-2 ${
                            isCorrectChoice
                              ? 'border-green-500 bg-green-50'
                              : isUserChoice
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-700">
                              {choiceNumber}.
                            </span>
                            <span className="text-gray-900">{choice}</span>
                            {isCorrectChoice && (
                              <span className="ml-auto text-green-600 font-semibold">
                                ✓ 正解
                              </span>
                            )}
                            {isUserChoice && !isCorrectChoice && (
                              <span className="ml-auto text-red-600 font-semibold">
                                ✗ あなたの回答
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 解説 */}
                  {question.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">
                        解説
                      </h4>
                      <p className="text-sm text-blue-800">{question.explanation}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 再挑戦ボタン */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/exam/start"
              className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              もう一度挑戦する
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
