'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function PDFDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const pdfId = params.id as string

  const [pdf, setPdf] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedCount, setGeneratedCount] = useState(0)

  useEffect(() => {
    fetchPDF()
  }, [])

  const fetchPDF = async () => {
    const { data, error } = await supabase
      .from('pdf_sources')
      .select('*')
      .eq('id', pdfId)
      .single()

    if (error || !data) {
      setError('PDFが見つかりません')
    } else {
      setPdf(data)
    }
    setLoading(false)
  }

  const handleGenerateQuestions = async () => {
    setGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfId: pdfId,
          count: 5, // 一度に5問生成
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '問題生成に失敗しました')
      }

      setGeneratedCount(data.count)
      alert(`${data.count}問の問題を生成しました`)
    } catch (err: any) {
      setError(err.message || '問題生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('このPDFを削除してもよろしいですか？')) {
      return
    }

    setLoading(true)
    try {
      // Storageから削除
      const filePath = pdf.file_url.split('/').pop()
      const { error: storageError } = await supabase.storage
        .from('exam-pdfs')
        .remove([`pdfs/${filePath}`])

      // DBから削除
      const { error: deleteError } = await supabase
        .from('pdf_sources')
        .delete()
        .eq('id', pdfId)

      if (deleteError) throw deleteError

      router.push('/admin/pdfs')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'PDFの削除に失敗しました')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !pdf) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error}</h1>
          <Link
            href="/admin/pdfs"
            className="text-indigo-600 hover:text-indigo-500"
          >
            ← PDF一覧に戻る
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
                href="/admin/pdfs"
                className="text-gray-600 hover:text-gray-900"
              >
                ← PDF一覧
              </Link>
              <h1 className="text-xl font-bold text-gray-900">PDF詳細</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {pdf.filename}
              </h3>
              {pdf.description && (
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {pdf.description}
                </p>
              )}
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">
                    アップロード日
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(pdf.upload_date).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">ファイルURL</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a
                      href={pdf.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-500"
                    >
                      PDFを開く
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                AI問題生成
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                このPDFを参考にして、AIが試験問題を自動生成します。
              </p>
              <button
                onClick={handleGenerateQuestions}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? '生成中...' : '問題を生成（5問）'}
              </button>
              {generatedCount > 0 && (
                <p className="mt-4 text-sm text-green-600">
                  {generatedCount}問の問題を生成しました
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              削除
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
