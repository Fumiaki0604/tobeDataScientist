'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Question = {
  id: number
  question_text: string
  difficulty: number
  source: string
  is_approved: boolean
  created_at: string
  category_id: number | null
  categories: {
    id: number
    name: string
  } | null
}

type Category = {
  id: number
  name: string
  parent_id: number | null
}

type Props = {
  questions: Question[]
  categories: Category[]
}

export default function QuestionsListClient({ questions, categories }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterApproved, setFilterApproved] = useState<string>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')

  // フィルタリングされた問題リスト
  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      // テキスト検索
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        if (!question.question_text.toLowerCase().includes(searchLower)) {
          return false
        }
      }

      // カテゴリフィルタ
      if (filterCategory !== 'all') {
        if (filterCategory === 'none') {
          if (question.category_id !== null) return false
        } else {
          if (question.category_id !== parseInt(filterCategory)) return false
        }
      }

      // 承認状態フィルタ
      if (filterApproved !== 'all') {
        if (filterApproved === 'approved' && !question.is_approved) return false
        if (filterApproved === 'not_approved' && question.is_approved) return false
      }

      // 難易度フィルタ
      if (filterDifficulty !== 'all') {
        if (question.difficulty !== parseInt(filterDifficulty)) return false
      }

      // ソースフィルタ
      if (filterSource !== 'all') {
        if (question.source !== filterSource) return false
      }

      return true
    })
  }, [questions, searchTerm, filterCategory, filterApproved, filterDifficulty, filterSource])

  // フィルタのリセット
  const resetFilters = () => {
    setSearchTerm('')
    setFilterCategory('all')
    setFilterApproved('all')
    setFilterDifficulty('all')
    setFilterSource('all')
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    filterCategory !== 'all' ||
    filterApproved !== 'all' ||
    filterDifficulty !== 'all' ||
    filterSource !== 'all'

  if (questions.length === 0) {
    return (
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          問題がありません
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          新しい問題を作成してください
        </p>
        <div className="mt-6">
          <Link
            href="/admin/questions/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            新規問題作成
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* フィルタ・検索パネル */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* テキスト検索 */}
          <div className="lg:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              問題文検索
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="キーワードを入力..."
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          {/* カテゴリフィルタ */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリ
            </label>
            <select
              id="category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="all">すべて</option>
              <option value="none">カテゴリなし</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_id ? '　' : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 承認状態フィルタ */}
          <div>
            <label htmlFor="approved" className="block text-sm font-medium text-gray-700 mb-1">
              承認状態
            </label>
            <select
              id="approved"
              value={filterApproved}
              onChange={(e) => setFilterApproved(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="all">すべて</option>
              <option value="approved">承認済み</option>
              <option value="not_approved">未承認</option>
            </select>
          </div>

          {/* 難易度フィルタ */}
          <div>
            <label htmlFor="difficulty" className="block text-sm font-medium text-gray-700 mb-1">
              難易度
            </label>
            <select
              id="difficulty"
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="all">すべて</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* ソースフィルタ */}
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              ソース
            </label>
            <select
              id="source"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 border"
            >
              <option value="all">すべて</option>
              <option value="manual">手動作成</option>
              <option value="ai_generated">AI生成</option>
              <option value="pdf_imported">PDF抽出</option>
            </select>
          </div>

          {/* リセットボタン */}
          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                フィルタをリセット
              </button>
            </div>
          )}
        </div>

        {/* 結果の表示 */}
        <div className="mt-4 text-sm text-gray-600">
          {filteredQuestions.length} / {questions.length} 件の問題を表示中
        </div>
      </div>

      {/* 問題一覧 */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            該当する問題が見つかりません
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            フィルタ条件を変更してください
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredQuestions.map((question) => (
              <li key={question.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          問題 #{question.id}
                        </p>
                        {question.categories && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {question.categories.name}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          難易度: {question.difficulty}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            question.is_approved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {question.is_approved ? '承認済み' : '未承認'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {question.source === 'ai_generated'
                            ? 'AI生成'
                            : question.source === 'pdf_imported'
                            ? 'PDF抽出'
                            : '手動作成'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-900">
                        {question.question_text}
                      </p>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span>
                          作成日:{' '}
                          {new Date(question.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/admin/questions/${question.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        編集
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
  )
}
