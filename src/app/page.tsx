'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Eye, MousePointer, MessageSquare, BarChart3 } from 'lucide-react'
import PropertySelector from '../components/PropertySelector'
import ChatInterface from '../components/ChatInterface'

interface AnalyticsDataItem {
  date: string
  activeUsers: number
  sessions: number
  screenPageViews: number
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('7daysAgo')
  const [error, setError] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('chat')

  const handlePropertySelected = (selectedPropertyId: string) => {
    setPropertyId(selectedPropertyId)
    setError('')
  }

  const fetchAnalyticsData = useCallback(async () => {
    if (!session || !propertyId) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/analytics?startDate=${dateRange}&endDate=today&metrics=activeUsers,sessions,screenPageViews&dimensions=date`)

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('プロパティIDが設定されていません')
        }
        throw new Error('データの取得に失敗しました')
      }

      const result = await response.json()
      setAnalyticsData(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [session, propertyId, dateRange])

  useEffect(() => {
    if (session && propertyId && activeTab === 'dashboard') {
      fetchAnalyticsData()
    }
  }, [session, propertyId, fetchAnalyticsData, activeTab])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">GA4 分析チャット</h1>
          <p className="text-gray-600 mb-6">
            Google Analytics 4のデータをAIと対話しながら分析できるツールです。
            <br />
            Googleアカウントでログインしてください。
          </p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Googleでログイン
          </button>
        </div>
      </div>
    )
  }

  // プロパティが選択されていない場合はPropertySelectorを表示
  if (!propertyId) {
    return (
      <div>
        <PropertySelector
          onPropertySelected={handlePropertySelected}
          selectedPropertyId={propertyId}
        />
      </div>
    )
  }

  const totalUsers = analyticsData.reduce((sum, item) => sum + (item.activeUsers || 0), 0)
  const totalSessions = analyticsData.reduce((sum, item) => sum + (item.sessions || 0), 0)
  const totalPageviews = analyticsData.reduce((sum, item) => sum + (item.screenPageViews || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GA4 分析ツール</h1>
              <p className="text-sm text-gray-600">AIと対話しながらデータを分析</p>
            </div>

            <div className="flex items-center gap-4">
              <PropertySelector
                onPropertySelected={handlePropertySelected}
                selectedPropertyId={propertyId}
              />

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{session.user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>

          {/* タブナビゲーション */}
          <div className="mt-4 border-b">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('chat')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  AIチャット分析
                </div>
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  ダッシュボード
                </div>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'chat' ? (
          <div>
            <ChatInterface propertyId={propertyId} />
          </div>
        ) : (
          <div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {/* 期間選択 */}
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">データダッシュボード</h2>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="7daysAgo">過去7日間</option>
                <option value="30daysAgo">過去30日間</option>
                <option value="90daysAgo">過去90日間</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">アクティブユーザー</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalUsers.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <MousePointer className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">セッション</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalSessions.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">ページビュー</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalPageviews.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">セッション推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-500">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ページビュー推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-500">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="screenPageViews" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}