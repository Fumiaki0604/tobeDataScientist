import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PDFsPage() {
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

  // PDF一覧を取得
  const { data: pdfs, error } = await supabase
    .from('pdf_sources')
    .select('*')
    .order('upload_date', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="text-gray-600 hover:text-gray-900"
              >
                ← 管理画面
              </Link>
              <h1 className="text-xl font-bold text-gray-900">PDF管理</h1>
            </div>
            <div className="flex items-center">
              <Link
                href="/admin/pdfs/upload"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                PDFアップロード
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              エラー: {error.message}
            </div>
          )}

          {!pdfs || pdfs.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                PDFがありません
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                過去問のPDFをアップロードしてください
              </p>
              <div className="mt-6">
                <Link
                  href="/admin/pdfs/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  PDFアップロード
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {pdfs.map((pdf: any) => (
                  <li key={pdf.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <svg
                              className="h-8 w-8 text-red-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {pdf.filename}
                              </p>
                              {pdf.description && (
                                <p className="text-sm text-gray-500">
                                  {pdf.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span>
                              アップロード日:{' '}
                              {new Date(pdf.upload_date).toLocaleDateString(
                                'ja-JP'
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/admin/pdfs/${pdf.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            詳細
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
