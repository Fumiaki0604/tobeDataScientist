'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditCategoryPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const categoryId = params.id as string

  const [parentCategories, setParentCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [childrenCount, setChildrenCount] = useState(0)

  const [formData, setFormData] = useState({
    name: '',
    parent_id: '',
    description: '',
    display_order: 1,
  })

  useEffect(() => {
    fetchParentCategories()
    fetchCategory()
    fetchQuestionCount()
    fetchChildrenCount()
  }, [])

  const fetchParentCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .is('parent_id', null)
      .neq('id', parseInt(categoryId))
      .order('display_order')

    if (data) {
      setParentCategories(data)
    }
  }

  const fetchCategory = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single()

    if (error || !data) {
      setNotFound(true)
      return
    }

    setFormData({
      name: data.name || '',
      parent_id: data.parent_id?.toString() || '',
      description: data.description || '',
      display_order: data.display_order || 1,
    })
  }

  const fetchQuestionCount = async () => {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', parseInt(categoryId))

    setQuestionCount(count || 0)
  }

  const fetchChildrenCount = async () => {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', parseInt(categoryId))

    setChildrenCount(count || 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({
          name: formData.name,
          parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
          description: formData.description || null,
          display_order: formData.display_order,
        })
        .eq('id', categoryId)

      if (updateError) throw updateError

      router.push('/admin/categories')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'カテゴリの更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (questionCount > 0) {
      if (
        !confirm(
          `このカテゴリには${questionCount}個の問題が紐付いています。削除すると問題のカテゴリがNULLになります。本当に削除しますか？`
        )
      ) {
        return
      }
    } else if (childrenCount > 0) {
      alert(
        `このカテゴリには${childrenCount}個の子カテゴリがあるため削除できません。先に子カテゴリを削除または移動してください。`
      )
      return
    } else {
      if (!confirm('このカテゴリを削除してもよろしいですか？')) {
        return
      }
    }

    setLoading(true)
    try {
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (deleteError) throw deleteError

      router.push('/admin/categories')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'カテゴリの削除に失敗しました')
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            カテゴリが見つかりません
          </h1>
          <Link
            href="/admin/categories"
            className="text-indigo-600 hover:text-indigo-500"
          >
            ← カテゴリ一覧に戻る
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
                href="/admin/categories"
                className="text-gray-600 hover:text-gray-900"
              >
                ← カテゴリ一覧
              </Link>
              <h1 className="text-xl font-bold text-gray-900">カテゴリ編集</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 統計情報 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">カテゴリ情報</h3>
            <div className="flex space-x-6 text-sm text-blue-700">
              <span>紐付けられた問題数: {questionCount}個</span>
              <span>子カテゴリ数: {childrenCount}個</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
              <div className="md:grid md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    カテゴリ情報
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    カテゴリの基本情報を編集してください
                  </p>
                </div>
                <div className="mt-5 md:mt-0 md:col-span-2">
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6">
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700"
                      >
                        カテゴリ名 *
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div className="col-span-6">
                      <label
                        htmlFor="parent"
                        className="block text-sm font-medium text-gray-700"
                      >
                        親カテゴリ
                      </label>
                      <select
                        id="parent"
                        value={formData.parent_id}
                        onChange={(e) =>
                          setFormData({ ...formData, parent_id: e.target.value })
                        }
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        disabled={childrenCount > 0}
                      >
                        <option value="">親カテゴリなし（トップレベル）</option>
                        {parentCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {childrenCount > 0 && (
                        <p className="mt-2 text-sm text-yellow-600">
                          子カテゴリがあるため、親カテゴリは変更できません
                        </p>
                      )}
                    </div>

                    <div className="col-span-6">
                      <label
                        htmlFor="display_order"
                        className="block text-sm font-medium text-gray-700"
                      >
                        表示順序
                      </label>
                      <input
                        type="number"
                        id="display_order"
                        min="1"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            display_order: parseInt(e.target.value),
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div className="col-span-6">
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
                      />
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
                  href="/admin/categories"
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
