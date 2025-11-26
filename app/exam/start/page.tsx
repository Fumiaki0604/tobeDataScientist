import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ExamStartForm from './ExamStartForm'

export default async function ExamStartPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // カテゴリ一覧を取得（親カテゴリのみ）
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, description')
    .is('parent_id', null)
    .order('display_order')

  // 試験設定を取得
  const { data: settings } = await supabase
    .from('exam_settings')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  // 問題総数を確認
  const { count: totalQuestions } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', true)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← ダッシュボード
              </Link>
              <h1 className="text-xl font-bold text-gray-900">試験設定</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              試験を開始する
            </h2>
            <p className="text-gray-600 mb-6">
              カテゴリと出題数を選択して試験を開始してください。
            </p>

            {totalQuestions === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-yellow-800">
                  問題が登録されていません。管理者に問題の作成を依頼してください。
                </p>
              </div>
            ) : (
              <ExamStartForm
                categories={categories || []}
                defaultQuestionCount={settings?.total_questions || 20}
                totalQuestions={totalQuestions || 0}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
