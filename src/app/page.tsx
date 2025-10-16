'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Eye, MousePointer, MessageSquare, BarChart3 } from 'lucide-react'
import PropertySelector from '../components/PropertySelector'
import ChatInterface from '../components/ChatInterface'
import ForecastTab from '../components/ForecastTab'

interface AnalyticsDataItem {
  date: string
  activeUsers: number
  sessions: number
  screenPageViews: number
  transactions: number
  totalRevenue: number
}

interface ChannelGroupDataItem {
  sessionDefaultChannelGrouping: string
  sessions: number
  transactions: number
  totalRevenue: number
}

interface TopProductItem {
  itemName: string
  itemRevenue: number
  itemsPurchased: number
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataItem[]>([])
  const [channelGroupData, setChannelGroupData] = useState<ChannelGroupDataItem[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('7daysAgo')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [error, setError] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'forecast'>('chat')
  const [deviceFilter, setDeviceFilter] = useState('all')
  const [forecastServerStatus, setForecastServerStatus] = useState<'checking' | 'ready' | 'unavailable' | 'starting'>('checking')
  const [isStartingServer, setIsStartingServer] = useState(false)
  const [forecastServerError, setForecastServerError] = useState('')

  const handlePropertySelected = (selectedPropertyId: string) => {
    setPropertyId(selectedPropertyId)
    setError('')
  }

  // Pythonサーバーの状態をチェック
  const checkForecastServerStatus = useCallback(async (skipIfStarting = false) => {
    // 起動中の場合はスキップ（起動プロセスを中断しない）
    if (skipIfStarting && forecastServerStatus === 'starting') {
      return
    }

    try {
      const response = await fetch('/api/forecast/health', { method: 'GET' })
      const data = await response.json()

      if (response.ok) {
        setForecastServerStatus('ready')
        setForecastServerError('')
      } else {
        // 起動中でない場合のみunavailableに設定
        if (forecastServerStatus !== 'starting') {
          setForecastServerStatus('unavailable')
          setForecastServerError(data.error || data.url || '')
        }
      }
    } catch (err) {
      // 起動中でない場合のみunavailableに設定
      if (forecastServerStatus !== 'starting') {
        setForecastServerStatus('unavailable')
        setForecastServerError(err instanceof Error ? err.message : '')
      }
    }
  }, [forecastServerStatus])

  // Pythonサーバーを起動
  const startForecastServer = async () => {
    setIsStartingServer(true)
    setForecastServerStatus('starting')
    try {
      const response = await fetch('/api/forecast/health', { method: 'POST' })
      const data = await response.json()

      if (response.ok && data.status === 'started') {
        setForecastServerStatus('ready')
        setIsStartingServer(false)
      } else {
        // 起動中の場合は10秒後に再チェック（最大12回=120秒）
        let retryCount = 0
        const maxRetries = 12
        const checkInterval = setInterval(async () => {
          retryCount++
          console.log(`予測サーバー起動チェック: ${retryCount}/${maxRetries}`)

          try {
            const checkResponse = await fetch('/api/forecast/health', { method: 'GET' })
            if (checkResponse.ok) {
              console.log('予測サーバー起動成功')
              setForecastServerStatus('ready')
              clearInterval(checkInterval)
              setIsStartingServer(false)
            } else if (retryCount >= maxRetries) {
              // 120秒（10秒×12回）経過しても起動しない場合
              console.log('予測サーバー起動タイムアウト')
              setForecastServerStatus('unavailable')
              clearInterval(checkInterval)
              setIsStartingServer(false)
            }
          } catch (error) {
            console.log(`起動チェックエラー (${retryCount}/${maxRetries}):`, error)
            if (retryCount >= maxRetries) {
              setForecastServerStatus('unavailable')
              clearInterval(checkInterval)
              setIsStartingServer(false)
            }
          }
        }, 10000)
      }
    } catch (err) {
      console.error('予測サーバー起動エラー:', err)
      // エラー時も再チェックを試みる
      setForecastServerStatus('starting')
      setTimeout(() => checkForecastServerStatus(false), 10000)
      setIsStartingServer(false)
    }
  }

  // 初回マウント時に状態をチェック、その後30秒ごとに定期チェック
  useEffect(() => {
    checkForecastServerStatus(false)
    // 30秒ごとに定期チェック（起動中の場合はスキップ）
    const interval = setInterval(() => checkForecastServerStatus(true), 30000)
    return () => clearInterval(interval)
  }, [checkForecastServerStatus])

  // ページロード時にlocalStorageからプロパティIDを取得
  // アカウント変更時にlocalStorageをクリア
  useEffect(() => {
    if (session) {
      const currentUserEmail = session.user?.email
      const savedUserEmail = localStorage.getItem('ga4-user-email')

      // アカウントが変更された場合、localStorageをクリア
      if (savedUserEmail && savedUserEmail !== currentUserEmail) {
        console.log('User account changed, clearing localStorage')
        localStorage.removeItem('ga4-property-id')
        localStorage.removeItem('ga4-properties-cache')
        localStorage.removeItem('ga4-user-email')
        // 即座にpropertyIdを空文字列にリセット
        setPropertyId('')
        // 現在のユーザーメールを保存
        if (currentUserEmail) {
          localStorage.setItem('ga4-user-email', currentUserEmail)
        }
        // アカウント変更時はここで処理を終了（localStorageから読み込まない）
        return
      }

      // 現在のユーザーメールを保存
      if (currentUserEmail) {
        localStorage.setItem('ga4-user-email', currentUserEmail)
      }

      // プロパティIDが未設定の場合のみlocalStorageから取得
      if (!propertyId) {
        const savedPropertyId = localStorage.getItem('ga4-property-id')
        if (savedPropertyId) {
          setPropertyId(savedPropertyId)
        }
      }
    }
  }, [session, propertyId])

  const fetchAnalyticsData = useCallback(async () => {
    if (!session || !propertyId) return

    setLoading(true)
    setError('')

    // 日付範囲を計算
    const startDate = dateRange === 'custom' ? customStartDate : dateRange
    const endDate = dateRange === 'custom' ? (customEndDate || new Date().toISOString().split('T')[0]) : 'today'

    // カスタム期間が選択されているが日付が未設定の場合はエラー
    if (dateRange === 'custom' && !customStartDate) {
      setError('開始日を選択してください')
      setLoading(false)
      return
    }

    try {
      // 日別データの取得
      // デバイスフィルターが有効な場合はdeviceCategoryディメンションを追加
      const dimensions = deviceFilter !== 'all' ? 'date,deviceCategory' : 'date'
      const response = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}&metrics=activeUsers,sessions,screenPageViews,transactions,totalRevenue&dimensions=${dimensions}&propertyId=${propertyId}`)

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('プロパティIDが設定されていません')
        }
        throw new Error('データの取得に失敗しました')
      }

      const result = await response.json()

      // デバイスフィルターを適用
      let filteredData = result.data || []
      if (deviceFilter !== 'all') {
        const deviceCategoryMap: Record<string, string> = {
          'desktop': 'desktop',
          'mobile': 'mobile'
        }
        filteredData = filteredData.filter((item: any) => {
          return item.deviceCategory?.toLowerCase() === deviceCategoryMap[deviceFilter]
        })
      }

      // データを日付順にソート（GA4の日付フォーマット "20250929" を考慮）
      const sortedData = filteredData.sort((a: AnalyticsDataItem, b: AnalyticsDataItem) => {
        // GA4の日付フォーマット "20250929" を "2025-09-29" に変換してソート
        const parseGA4Date = (dateStr: string) => {
          if (dateStr.length === 8) {
            const year = dateStr.substring(0, 4)
            const month = dateStr.substring(4, 6)
            const day = dateStr.substring(6, 8)
            return new Date(`${year}-${month}-${day}`).getTime()
          }
          return new Date(dateStr).getTime()
        }
        return parseGA4Date(a.date) - parseGA4Date(b.date)
      })
      setAnalyticsData(sortedData)

      // チャネルグループ別データの取得
      const channelDimensions = deviceFilter !== 'all' ? 'sessionDefaultChannelGrouping,deviceCategory' : 'sessionDefaultChannelGrouping'
      const channelResponse = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}&metrics=sessions,transactions,totalRevenue&dimensions=${channelDimensions}&propertyId=${propertyId}`)

      if (channelResponse.ok) {
        const channelResult = await channelResponse.json()

        // デバイスフィルターを適用
        let filteredChannelData = channelResult.data || []
        if (deviceFilter !== 'all') {
          const deviceCategoryMap: Record<string, string> = {
            'desktop': 'desktop',
            'mobile': 'mobile'
          }
          filteredChannelData = filteredChannelData.filter((item: any) => {
            return item.deviceCategory?.toLowerCase() === deviceCategoryMap[deviceFilter]
          })
        }

        // チャネルグループのマッピングルール
        const channelMapping: Record<string, string> = {
          'Cross-network': '広告',
          'Paid Search': '広告',
          'Display': '広告',
          'Paid Social': '広告',
          'Paid Other': '広告',
          'Paid Video': '広告',
          'Paid Shopping': '広告',
          'Organic Social': 'SNS',
          'Organic Search': '自然検索',
          'Organic Video': '自然検索',
          'Organic Shopping': '自然検索',
        }

        // チャネルグループごとに集計
        const aggregated: Record<string, ChannelGroupDataItem> = {}

        filteredChannelData.forEach((item: ChannelGroupDataItem) => {
          const mappedChannel = channelMapping[item.sessionDefaultChannelGrouping] || item.sessionDefaultChannelGrouping

          if (!aggregated[mappedChannel]) {
            aggregated[mappedChannel] = {
              sessionDefaultChannelGrouping: mappedChannel,
              sessions: 0,
              transactions: 0,
              totalRevenue: 0,
            }
          }

          aggregated[mappedChannel].sessions += item.sessions
          aggregated[mappedChannel].transactions += item.transactions
          aggregated[mappedChannel].totalRevenue += item.totalRevenue
        })

        // セッション数で降順ソート
        const sortedChannelData = Object.values(aggregated).sort((a, b) => {
          return b.sessions - a.sessions
        })

        setChannelGroupData(sortedChannelData)
      }

      // 商品別売上TOP10の取得（limit=10で最適化）
      const productDimensions = deviceFilter !== 'all' ? 'itemName,deviceCategory' : 'itemName'
      const productsResponse = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}&metrics=itemRevenue,itemsPurchased&dimensions=${productDimensions}&propertyId=${propertyId}&limit=10`)

      if (productsResponse.ok) {
        const productsResult = await productsResponse.json()

        // デバイスフィルターを適用
        let filteredProductData = productsResult.data || []
        if (deviceFilter !== 'all') {
          const deviceCategoryMap: Record<string, string> = {
            'desktop': 'desktop',
            'mobile': 'mobile'
          }
          filteredProductData = filteredProductData.filter((item: any) => {
            return item.deviceCategory?.toLowerCase() === deviceCategoryMap[deviceFilter]
          })
        }

        // 売上で降順ソート（GA4 APIがlimitを適用するがソートが必要な場合もある）
        const sortedProducts = filteredProductData
          .filter((item: TopProductItem) => item.itemName && item.itemRevenue > 0)
          .sort((a: TopProductItem, b: TopProductItem) => b.itemRevenue - a.itemRevenue)
          .slice(0, 10) // デバイスフィルター後にTOP10を確保
        setTopProducts(sortedProducts)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [session, propertyId, dateRange, customStartDate, customEndDate, deviceFilter])

  useEffect(() => {
    if (session && propertyId && (activeTab === 'dashboard' || activeTab === 'forecast')) {
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
          <h1 className="text-2xl font-bold mb-4 text-gray-900">GA4 分析チャット</h1>
          <p className="text-gray-900 mb-6">
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
  const totalTransactions = analyticsData.reduce((sum, item) => sum + (item.transactions || 0), 0)
  const totalRevenue = analyticsData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GA4 分析ツール</h1>
              <p className="text-sm text-gray-900">AIと対話しながらデータを分析</p>
            </div>

            <div className="flex items-center gap-4">
              <PropertySelector
                onPropertySelected={handlePropertySelected}
                selectedPropertyId={propertyId}
              />

              {/* 予測サーバー状態表示 */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      forecastServerStatus === 'ready' ? 'bg-green-500' :
                      forecastServerStatus === 'starting' ? 'bg-yellow-500 animate-pulse' :
                      forecastServerStatus === 'checking' ? 'bg-blue-500 animate-pulse' :
                      'bg-red-500'
                    }`} />
                    <span className="text-xs font-medium text-gray-700">
                      {forecastServerStatus === 'ready' ? '予測API: 起動中' :
                       forecastServerStatus === 'starting' ? '予測API: 起動中...（最大2分）' :
                       forecastServerStatus === 'checking' ? '予測API: 確認中...' :
                       '予測API: 停止中'}
                    </span>
                  </div>
                  {forecastServerStatus === 'unavailable' && (
                    <button
                      onClick={startForecastServer}
                      disabled={isStartingServer}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      title="予測サーバーを起動します（60秒〜120秒かかります）"
                    >
                      起動
                    </button>
                  )}
                </div>
                {forecastServerError && (
                  <div className="text-xs text-red-600 px-3">
                    {forecastServerError}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-900">{session.user?.email}</span>
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
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
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
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  ダッシュボード
                </div>
              </button>

              <button
                onClick={() => {
                  if (forecastServerStatus === 'ready') {
                    setActiveTab('forecast')
                  }
                }}
                disabled={forecastServerStatus !== 'ready'}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'forecast'
                    ? 'border-blue-500 text-blue-600'
                    : forecastServerStatus !== 'ready'
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-900 hover:text-gray-900 hover:border-gray-300'
                }`}
                title={forecastServerStatus !== 'ready' ? '予測APIが起動していません' : ''}
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  売上予測
                  {forecastServerStatus !== 'ready' && (
                    <span className="text-xs text-gray-400">(要起動)</span>
                  )}
                </div>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* チャットタブ */}
        <div className={activeTab === 'chat' ? '' : 'hidden'}>
          <ChatInterface propertyId={propertyId} />
        </div>

        {/* ダッシュボードタブ */}
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* 期間選択 */}
          <div className="mb-6 flex justify-between items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">データダッシュボード</h2>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="border rounded-lg px-3 py-2 text-gray-900"
              >
                <option value="7daysAgo">過去7日間</option>
                <option value="30daysAgo">過去30日間</option>
                <option value="90daysAgo">過去90日間</option>
                <option value="180daysAgo">過去180日間</option>
                <option value="365daysAgo">過去365日間</option>
                <option value="custom">カスタム</option>
              </select>

              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-gray-900"
              >
                <option value="all">すべて</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">モバイル</option>
              </select>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-gray-900"
                    placeholder="開始日"
                  />
                  <span className="text-gray-900">〜</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-gray-900"
                    placeholder="終了日"
                  />
                </div>
              )}
            </div>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">アクティブユーザー</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalUsers.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <MousePointer className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">セッション</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalSessions.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">ページビュー</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalPageviews.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">トランザクション</p>
                    <p className="text-2xl font-semibold text-gray-900">{totalTransactions.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <div className="h-8 w-8 text-red-600 flex items-center justify-center">
                    <span className="text-lg font-bold">¥</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">売上</p>
                    <p className="text-2xl font-semibold text-gray-900">¥{totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">セッション推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }
                          return value
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
                          }
                          return value
                        }}
                      />
                      <Line type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ページビュー推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }
                          return value
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
                          }
                          return value
                        }}
                      />
                      <Bar dataKey="screenPageViews" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">トランザクション数推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }
                          return value
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
                          }
                          return value
                        }}
                      />
                      <Line type="monotone" dataKey="transactions" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }
                          return value
                        }}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => {
                          const dateStr = value.toString()
                          if (dateStr.length === 8) {
                            const year = dateStr.substring(0, 4)
                            const month = dateStr.substring(4, 6)
                            const day = dateStr.substring(6, 8)
                            const date = new Date(`${year}-${month}-${day}`)
                            return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
                          }
                          return value
                        }}
                        formatter={(value: number) => `¥${value.toLocaleString()}`}
                      />
                      <Bar dataKey="totalRevenue" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* チャネルグループ別マトリックス */}
            <div className="mt-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">デフォルトチャネルグループ別分析</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : channelGroupData.length === 0 ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="text-gray-900">チャネルグループデータがありません</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            チャネルグループ
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            セッション数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            トランザクション数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            売上
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            コンバージョン率
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            平均注文単価
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {channelGroupData.map((item, index) => {
                          const conversionRate = item.sessions > 0 ? (item.transactions / item.sessions * 100) : 0
                          const avgOrderValue = item.transactions > 0 ? (item.totalRevenue / item.transactions) : 0

                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.sessionDefaultChannelGrouping || 'その他'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.sessions.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.transactions.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ¥{item.totalRevenue.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {conversionRate.toFixed(2)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ¥{avgOrderValue.toLocaleString()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 売上上位商品TOP10 */}
            <div className="mt-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">売上上位商品 TOP10</h3>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-gray-900">読み込み中...</div>
                  </div>
                ) : topProducts.length === 0 ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="text-gray-900">商品データがありません</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            順位
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            商品名
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            売上
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            購入数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                            平均単価
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {topProducts.map((item, index) => {
                          const avgPrice = item.itemsPurchased > 0 ? item.itemRevenue / item.itemsPurchased : 0

                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {index + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.itemName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ¥{Math.round(item.itemRevenue).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Math.round(item.itemsPurchased).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ¥{Math.round(avgPrice).toLocaleString()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* 予測タブ */}
        <div className={activeTab === 'forecast' ? '' : 'hidden'}>
          <ForecastTab
            propertyId={propertyId}
            analyticsData={analyticsData}
          />
        </div>
      </main>
    </div>
  )
}