'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import { TrendingUp, Calendar, DollarSign } from 'lucide-react'

interface ForecastTabProps {
  propertyId: string
  analyticsData: Array<{
    date: string
    totalRevenue: number
  }>
}

export default function ForecastTab({ propertyId, analyticsData }: ForecastTabProps) {
  const [forecastData, setForecastData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [periods, setPeriods] = useState(30)
  const [error, setError] = useState('')
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'waking'>('checking')

  // コンポーネントマウント時にPython APIをウェイクアップ
  useEffect(() => {
    const wakeUpApi = async () => {
      try {
        setApiStatus('checking')
        const response = await fetch('/api/forecast/health', { method: 'GET' })
        if (response.ok) {
          setApiStatus('ready')
        } else {
          setApiStatus('waking')
          // 30秒後に再チェック
          setTimeout(() => {
            fetch('/api/forecast/health').then(res => {
              if (res.ok) setApiStatus('ready')
            })
          }, 30000)
        }
      } catch (err) {
        setApiStatus('waking')
      }
    }
    wakeUpApi()
  }, [])

  const handleForecast = async () => {
    if (analyticsData.length < 7) {
      setError('予測には最低7日分のデータが必要です')
      return
    }

    setLoading(true)
    setError('')

    try {
      // GA4データを予測API用に変換
      const data = analyticsData.map(item => ({
        date: item.date,
        value: item.totalRevenue || 0
      }))

      const response = await fetch('/api/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          periods,
          metric_name: '売上（円）'
        }),
      })

      if (!response.ok) {
        throw new Error('予測に失敗しました')
      }

      const result = await response.json()
      setForecastData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '予測エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // グラフ用データの結合
  const chartData = forecastData
    ? [
        ...forecastData.historical.map((item: any) => ({
          date: item.date,
          actual: item.value,
          predicted: item.predicted,
          lower: item.lower,
          upper: item.upper,
          isForecast: false
        })),
        ...forecastData.forecast.map((item: any) => ({
          date: item.date,
          actual: null,
          predicted: item.predicted,
          lower: item.lower,
          upper: item.upper,
          isForecast: true
        }))
      ]
    : []

  // 予測期間の売上合計
  const forecastTotal = forecastData
    ? forecastData.forecast.reduce((sum: number, item: any) => sum + item.predicted, 0)
    : 0

  return (
    <div className="space-y-6">
      {/* 予測設定 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          売上予測
        </h2>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予測期間（日数）
              </label>
              <input
                type="number"
                min="7"
                max="90"
                value={periods}
                onChange={(e) => setPeriods(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleForecast}
              disabled={loading || analyticsData.length < 7}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              {loading ? '予測中...' : '予測を実行'}
            </button>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {analyticsData.length < 7 && (
            <div className="text-amber-600 text-sm">
              ※ 予測を実行するには、最低7日分のデータが必要です
            </div>
          )}

          {/* API起動状態 */}
          {apiStatus === 'waking' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              予測APIを起動しています...（初回は30秒〜1分かかる場合があります）
            </div>
          )}
          {apiStatus === 'checking' && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              予測APIの状態を確認中...
            </div>
          )}
        </div>
      </div>

      {/* 予測サマリー */}
      {forecastData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">予測期間の売上合計</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              ¥{forecastTotal.toLocaleString()}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">予測期間</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {periods}日間
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 text-purple-700 mb-2">
              <Calendar className="h-5 w-5" />
              <span className="text-sm font-medium">1日あたり平均</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              ¥{Math.round(forecastTotal / periods).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* 予測グラフ */}
      {forecastData && chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">売上推移と予測</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                labelFormatter={(label) => `日付: ${label}`}
              />
              <Legend />

              {/* 信頼区間 */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.1}
                name="信頼区間上限"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.1}
                name="信頼区間下限"
              />

              {/* 実績値 */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="実績"
              />

              {/* 予測値 */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="予測"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">予測について</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Meta社のProphetライブラリを使用した時系列予測</li>
          <li>• 過去のトレンドや季節性を考慮した高精度な予測</li>
          <li>• 青い点線が予測値、薄青の範囲が95%信頼区間</li>
          <li>• 最低7日分のデータが必要です</li>
        </ul>
      </div>
    </div>
  )
}
