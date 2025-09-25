'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Users, Eye, MousePointer } from 'lucide-react'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('7daysAgo')
  const [error, setError] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [propertyIdInput, setPropertyIdInput] = useState('')
  const [showPropertySetup, setShowPropertySetup] = useState(false)

  const fetchPropertyId = async () => {
    try {
      const response = await fetch('/api/property')
      if (response.ok) {
        const result = await response.json()
        if (result.propertyId) {
          setPropertyId(result.propertyId)
        } else {
          setShowPropertySetup(true)
        }
      }
    } catch (err) {
      console.error('プロパティID取得エラー:', err)
      setShowPropertySetup(true)
    }
  }

  const savePropertyId = async () => {
    if (!propertyIdInput.trim()) {
      setError('プロパティIDを入力してください')
      return
    }

    try {
      const response = await fetch('/api/property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ propertyId: propertyIdInput.trim() }),
      })

      if (response.ok) {
        setPropertyId(propertyIdInput.trim())
        setShowPropertySetup(false)
        setError('')
        fetchAnalyticsData()
      } else {
        throw new Error('プロパティIDの保存に失敗しました')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchAnalyticsData = async () => {
    if (!session || !propertyId) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/analytics?startDate=${dateRange}&endDate=today&metrics=activeUsers,sessions,pageviews&dimensions=date`)

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
  }

  useEffect(() => {
    if (session) {
      fetchPropertyId()
    }
  }, [session])

  useEffect(() => {
    if (session && propertyId) {
      fetchAnalyticsData()
    }
  }, [session, propertyId, dateRange])

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
          <h1 className="text-2xl font-bold mb-4">Google Analytics ダッシュボード</h1>
          <p className="text-gray-600 mb-6">
            Google Analyticsのデータを表示するには、Googleアカウントでログインしてください。
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

  if (showPropertySetup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">GA4 プロパティ設定</h1>
          <p className="text-gray-600 mb-6">
            Google Analytics 4のプロパティIDを入力してください。
            <br />
            例: 123456789
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <input
            type="text"
            value={propertyIdInput}
            onChange={(e) => setPropertyIdInput(e.target.value)}
            placeholder="プロパティID"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-4">
            <button
              onClick={savePropertyId}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              設定
            </button>
            <button
              onClick={() => signOut()}
              className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalUsers = analyticsData.reduce((sum, item) => sum + (item.activeUsers || 0), 0)
  const totalSessions = analyticsData.reduce((sum, item) => sum + (item.sessions || 0), 0)
  const totalPageviews = analyticsData.reduce((sum, item) => sum + (item.pageviews || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Analytics ダッシュボード</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">プロパティ: {propertyId}</span>
            <button
              onClick={() => setShowPropertySetup(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              変更
            </button>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="7daysAgo">過去7日間</option>
              <option value="30daysAgo">過去30日間</option>
              <option value="90daysAgo">過去90日間</option>
            </select>
            <span className="text-sm text-gray-600">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:text-red-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

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
                  <Bar dataKey="pageviews" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
