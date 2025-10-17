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
  const [periodType, setPeriodType] = useState<'current_month' | 'next_month'>('current_month')
  const [error, setError] = useState('')
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'waking'>('checking')
  const [monthlyActualData, setMonthlyActualData] = useState<{ [key: string]: number }>({})
  const [trainingData, setTrainingData] = useState<Array<{ date: string; totalRevenue: number }>>([])
  const [trainingPeriod, setTrainingPeriod] = useState<365 | 730>(365) // デフォルト365日

  // 期間の計算
  const calculatePeriods = () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    if (periodType === 'current_month') {
      // 今月末まで
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0)
      const daysUntilEndOfMonth = Math.ceil((endOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilEndOfMonth
    } else {
      // 来月末まで
      const endOfNextMonth = new Date(currentYear, currentMonth + 2, 0)
      const daysUntilEndOfNextMonth = Math.ceil((endOfNextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilEndOfNextMonth
    }
  }

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

  // 予測用の学習データと月次実績データを取得
  useEffect(() => {
    const fetchTrainingData = async () => {
      if (!propertyId) return

      try {
        const today = new Date()
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth()

        // 指定された日数前
        const startDate = new Date(today)
        startDate.setDate(today.getDate() - trainingPeriod)
        const startDateStr = startDate.toISOString().split('T')[0]

        // 今日
        const todayStr = today.toISOString().split('T')[0]

        console.log(`学習データ取得開始: ${trainingPeriod}日間 (${startDateStr} 〜 ${todayStr})`)

        // 過去のデータを取得（予測用）
        const response = await fetch(
          `/api/analytics?startDate=${startDateStr}&endDate=${todayStr}&metrics=totalRevenue&dimensions=date&propertyId=${propertyId}`
        )

        if (response.ok) {
          const result = await response.json()
          const data = result.data || []

          // 日付フォーマットを統一してソート
          const formattedData = data.map((item: any) => {
            const dateStr = item.date.length === 8
              ? `${item.date.substring(0, 4)}-${item.date.substring(4, 6)}-${item.date.substring(6, 8)}`
              : item.date
            return {
              date: dateStr,
              totalRevenue: item.totalRevenue || 0
            }
          }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

          setTrainingData(formattedData)
          console.log(`予測用データ取得完了: ${formattedData.length}日分`)

          // 月別に集計（月次実績表示用）
          const monthlyData: { [key: string]: number } = {}
          data.forEach((item: any) => {
            const itemDate = new Date(item.date.length === 8
              ? `${item.date.substring(0, 4)}-${item.date.substring(4, 6)}-${item.date.substring(6, 8)}`
              : item.date)
            const monthKey = `${itemDate.getFullYear()}/${String(itemDate.getMonth() + 1).padStart(2, '0')}`

            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = 0
            }
            monthlyData[monthKey] += item.totalRevenue || 0
          })

          setMonthlyActualData(monthlyData)
        }
      } catch (err) {
        console.error('予測用データの取得に失敗:', err)
      }
    }

    fetchTrainingData()
  }, [propertyId, trainingPeriod]) // trainingPeriod変更時も再取得

  const handleForecast = async () => {
    if (trainingData.length < 7) {
      setError('予測には最低7日分のデータが必要です。データを取得中の場合は少々お待ちください。')
      return
    }

    setLoading(true)
    setError('')

    try {
      const periods = calculatePeriods()

      // 予測用の学習データ（90日間）を使用
      const data = trainingData.map(item => ({
        date: item.date,
        value: item.totalRevenue || 0
      }))

      console.log(`予測実行: ${data.length}日分のデータで学習、${periods}日間予測`)

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

  // グラフ用データの結合（予測期間に応じてフィルタリング）
  const chartData = forecastData
    ? (() => {
        const today = new Date()
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth()

        // 表示する月の範囲を決定
        const startOfCurrentMonth = new Date(currentYear, currentMonth, 1)
        const endOfTargetMonth = periodType === 'current_month'
          ? new Date(currentYear, currentMonth + 1, 0) // 今月末
          : new Date(currentYear, currentMonth + 2, 0) // 来月末

        const allData = [
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

        // 今月初日以降のデータのみ表示
        return allData.filter(item => {
          const itemDate = new Date(item.date)
          return itemDate >= startOfCurrentMonth && itemDate <= endOfTargetMonth
        })
      })()
    : []

  // 予測期間の売上合計
  const forecastTotal = forecastData
    ? forecastData.forecast.reduce((sum: number, item: any) => sum + item.predicted, 0)
    : 0

  // 月別売上予測の計算
  const calculateMonthlySales = () => {
    if (!forecastData) return []

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    // 予測期間に応じて表示する月を決定
    const targetMonths = new Set<string>()
    const currentMonthKey = `${currentYear}/${String(currentMonth + 1).padStart(2, '0')}`
    targetMonths.add(currentMonthKey)

    if (periodType === 'next_month') {
      const nextMonthKey = `${currentMonth === 11 ? currentYear + 1 : currentYear}/${String((currentMonth + 2) % 12 || 12).padStart(2, '0')}`
      targetMonths.add(nextMonthKey)
    }

    // 月別に集計
    const monthlyData: { [key: string]: { actual: number, forecast: number } } = {}

    // 月初からの実績データを使用
    Object.entries(monthlyActualData).forEach(([monthKey, actualRevenue]) => {
      if (targetMonths.has(monthKey)) {
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { actual: 0, forecast: 0 }
        }
        monthlyData[monthKey].actual = actualRevenue
      }
    })

    // 予測データの集計
    forecastData.forecast.forEach((item: any) => {
      const itemDate = new Date(item.date)
      const monthKey = `${itemDate.getFullYear()}/${String(itemDate.getMonth() + 1).padStart(2, '0')}`

      if (targetMonths.has(monthKey)) {
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { actual: 0, forecast: 0 }
        }
        monthlyData[monthKey].forecast += item.predicted
      }
    })

    // 結果を配列に変換して返す
    return Object.entries(monthlyData)
      .filter(([month]) => targetMonths.has(month))
      .map(([month, data]) => ({
        month,
        actual: data.actual,
        forecast: data.forecast,
        total: data.actual + data.forecast
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  const monthlySales = calculateMonthlySales()

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
                学習期間
              </label>
              <select
                value={trainingPeriod}
                onChange={(e) => setTrainingPeriod(Number(e.target.value) as 365 | 730)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="365">過去365日間（1年、推奨）</option>
                <option value="730">過去730日間（2年）</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                予測期間
              </label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as 'current_month' | 'next_month')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="current_month">今月末まで（{calculatePeriods()}日間）</option>
                <option value="next_month">来月末まで（{calculatePeriods()}日間）</option>
              </select>
            </div>
            <button
              onClick={handleForecast}
              disabled={loading || trainingData.length < 7}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              {loading ? '予測中...' : '予測を実行'}
            </button>
          </div>

          {/* 学習データ情報 */}
          {trainingData.length > 0 && (
            <div className="text-sm text-gray-900 font-medium">
              学習データ: 過去{trainingData.length}日分（{trainingData[0]?.date} 〜 {trainingData[trainingData.length - 1]?.date}）
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {trainingData.length < 7 && trainingData.length > 0 && (
            <div className="text-amber-600 text-sm">
              ※ 予測を実行するには、最低7日分のデータが必要です（現在: {trainingData.length}日分）
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
        <>
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
                {calculatePeriods()}日間
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm font-medium">1日あたり平均</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                ¥{Math.round(forecastTotal / calculatePeriods()).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 月別売上予測 */}
          {monthlySales.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">月別売上予測</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        月
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">
                        実績売上
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">
                        予測売上
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">
                        合計
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlySales.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.month}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          ¥{Math.round(item.actual).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-medium">
                          ¥{Math.round(item.forecast).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          ¥{Math.round(item.total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
