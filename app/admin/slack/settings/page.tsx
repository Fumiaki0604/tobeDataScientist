'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Channel {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

interface DeliverySettings {
  id: number
  workspace_id: string
  channel_id: string
  channel_name: string
  delivery_time: string
  difficulty_filter: string[] | null
  category_filter: string[] | null
  is_active: boolean
}

const DIFFICULTIES = ['初級', '中級', '上級']
const CATEGORIES = [
  '基礎数学',
  '統計学',
  '機械学習',
  'データエンジニアリング',
  'ビジネス力',
]

export default function SlackSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // フォーム状態
  const [selectedChannel, setSelectedChannel] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('09:00')
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    checkAdminAccess()
    fetchChannels()
    fetchSettings()
  }, [])

  const checkAdminAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/dashboard')
    }
  }

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/slack/channels')
      if (!response.ok) {
        throw new Error('Failed to fetch channels')
      }
      const data = await response.json()
      setChannels(data.channels || [])
    } catch (err: any) {
      console.error('Error fetching channels:', err)
      setError(err.message)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/slack/settings')
      if (!response.ok) {
        if (response.status === 404) {
          // 設定がまだない場合
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch settings')
      }
      const data = await response.json()
      if (data.settings) {
        setSettings(data.settings)
        setSelectedChannel(data.settings.channel_id)
        setDeliveryTime(data.settings.delivery_time)
        setSelectedDifficulties(data.settings.difficulty_filter || [])
        setSelectedCategories(data.settings.category_filter || [])
        setIsActive(data.settings.is_active)
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!selectedChannel) {
      setError('配信先チャンネルを選択してください')
      return
    }

    const channel = channels.find((c) => c.id === selectedChannel)
    if (!channel) {
      setError('選択されたチャンネルが見つかりません')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/slack/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: selectedChannel,
          channel_name: channel.name,
          delivery_time: deliveryTime,
          difficulty_filter:
            selectedDifficulties.length > 0 ? selectedDifficulties : null,
          category_filter:
            selectedCategories.length > 0 ? selectedCategories : null,
          is_active: isActive,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      const data = await response.json()
      setSettings(data.settings)
      setSuccess('設定を保存しました')
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleDifficulty = (difficulty: string) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty)
        ? prev.filter((d) => d !== difficulty)
        : [...prev, difficulty]
    )
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/admin/slack"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Slack連携管理に戻る
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">配信設定</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* エラーメッセージ */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {/* 成功メッセージ */}
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    {success}
                  </h3>
                </div>
              </div>
            </div>
          )}

          {/* 設定フォーム */}
          <form onSubmit={handleSave}>
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-6">
                  {/* チャンネル選択 */}
                  <div>
                    <label
                      htmlFor="channel"
                      className="block text-sm font-medium text-gray-700"
                    >
                      配信先チャンネル
                    </label>
                    <select
                      id="channel"
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      required
                    >
                      <option value="">チャンネルを選択...</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.is_private ? '🔒' : '#'} {channel.name}
                          {!channel.is_member && ' (未参加)'}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-sm text-gray-500">
                      Botがメッセージを投稿するチャンネルを選択してください
                    </p>
                  </div>

                  {/* 配信時刻 */}
                  <div>
                    <label
                      htmlFor="time"
                      className="block text-sm font-medium text-gray-700"
                    >
                      配信時刻（JST）
                    </label>
                    <input
                      type="time"
                      id="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      毎日この時刻に問題が配信されます（日本時間）
                    </p>
                  </div>

                  {/* 難易度フィルタ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      難易度フィルタ（任意）
                    </label>
                    <div className="space-y-2">
                      {DIFFICULTIES.map((difficulty) => (
                        <div key={difficulty} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`difficulty-${difficulty}`}
                            checked={selectedDifficulties.includes(difficulty)}
                            onChange={() => toggleDifficulty(difficulty)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`difficulty-${difficulty}`}
                            className="ml-3 text-sm text-gray-700"
                          >
                            {difficulty}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      選択しない場合は全ての難易度から出題されます
                    </p>
                  </div>

                  {/* カテゴリフィルタ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      カテゴリフィルタ（任意）
                    </label>
                    <div className="space-y-2">
                      {CATEGORIES.map((category) => (
                        <div key={category} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`category-${category}`}
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleCategory(category)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`category-${category}`}
                            className="ml-3 text-sm text-gray-700"
                          >
                            {category}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      選択しない場合は全てのカテゴリから出題されます
                    </p>
                  </div>

                  {/* 配信有効/無効 */}
                  <div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="is_active"
                        className="ml-3 text-sm font-medium text-gray-700"
                      >
                        配信を有効にする
                      </label>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      無効にすると自動配信が停止します
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 rounded-b-lg">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </div>
          </form>

          {/* ヒント */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              💡 設定のヒント
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>配信時刻は日本時間（JST）で設定されます</li>
              <li>
                プライベートチャンネルに配信する場合は、事前にBotをチャンネルに招待してください
              </li>
              <li>
                難易度やカテゴリを選択しない場合、全ての問題からランダムに出題されます
              </li>
              <li>設定はいつでも変更できます</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
