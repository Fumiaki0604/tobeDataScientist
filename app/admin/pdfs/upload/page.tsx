'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UploadPDFPage() {
  const router = useRouter()
  const supabase = createClient()

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    description: '',
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== 'application/pdf') {
        setError('PDFファイルを選択してください')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('ファイルを選択してください')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('ログインが必要です')
      }

      // ファイル名を生成（タイムスタンプ付き）
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name}`
      const filePath = `pdfs/${fileName}`

      // Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('exam-pdfs')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 公開URLを取得
      const { data: urlData } = supabase.storage
        .from('exam-pdfs')
        .getPublicUrl(filePath)

      // DBに記録
      const { error: insertError } = await supabase
        .from('pdf_sources')
        .insert({
          filename: file.name,
          file_url: urlData.publicUrl,
          description: formData.description || null,
          uploaded_by: user.id,
        })

      if (insertError) throw insertError

      router.push('/admin/pdfs')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
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
              <h1 className="text-xl font-bold text-gray-900">PDFアップロード</h1>
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
                    PDFファイル
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    過去問のPDFファイルを選択してください
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        ファイル選択 *
                      </label>
                      <div className="mt-1 flex items-center">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileChange}
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-indigo-50 file:text-indigo-700
                            hover:file:bg-indigo-100"
                        />
                      </div>
                      {file && (
                        <p className="mt-2 text-sm text-gray-500">
                          選択中: {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    詳細情報
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    PDFに関する情報を入力してください（任意）
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700"
                    >
                      説明
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="このPDFに関する説明を入力してください"
                    />
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

            <div className="flex justify-end space-x-3">
              <Link
                href="/admin/pdfs"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={uploading || !file}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {uploading ? 'アップロード中...' : 'アップロード'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
