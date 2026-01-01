'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SlackIntegration {
  id: number
  workspace_id: string
  workspace_name: string
  team_name: string | null
  bot_user_id: string
  installed_by: string | null
  installed_at: string
  is_active: boolean
  last_health_check: string | null
}

export default function SlackAdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [integration, setIntegration] = useState<SlackIntegration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkAdminAccess()
    fetchIntegration()

    // URLパラメータからエラーや成功メッセージを取得
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const successParam = params.get('success')

    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
    if (successParam) {
      setSuccess('Slack連携が完了しました')
    }
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

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('slack_integrations')
        .select('*')
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = レコードが見つからない
        throw error
      }

      setIntegration(data)
    } catch (err: any) {
      console.error('Error fetching integration:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectSlack = () => {
    const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID
    const redirectUri = `${window.location.origin}/api/slack/oauth/callback`
    const scopes = [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'users:read',
      'im:write',
    ].join(',')

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`

    window.location.href = authUrl
  }

  const handleDisconnect = async () => {
    if (!integration) return

    if (
      !confirm(
        'Slack連携を解除してもよろしいですか？\n配信設定や履歴データは削除されます。'
      )
    ) {
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('slack_integrations')
        .update({ is_active: false })
        .eq('id', integration.id)

      if (error) throw error

      setSuccess('Slack連携を解除しました')
      setIntegration(null)
    } catch (err: any) {
      console.error('Error disconnecting:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                ← 管理ダッシュボードに戻る
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Slack連携管理</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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

          {/* メインコンテンツ */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              {!integration ? (
                <>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Slack連携を開始
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    Slackワークスペースと連携して、毎日の問題配信機能を利用できます。
                  </p>
                  <button
                    onClick={handleConnectSlack}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg
                      className="mr-2 h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                    </svg>
                    Slackと連携する
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    連携中のワークスペース
                  </h2>
                  <div className="mb-6">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          ワークスペース名
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {integration.workspace_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          ワークスペースID
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {integration.workspace_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Bot User ID
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {integration.bot_user_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          連携日時
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(integration.installed_at).toLocaleString(
                            'ja-JP'
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex space-x-4">
                    <Link
                      href="/admin/slack/settings"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      配信設定
                    </Link>
                    <Link
                      href="/admin/slack/history"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      配信履歴
                    </Link>
                    <button
                      onClick={handleDisconnect}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                      連携解除
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 機能説明 */}
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Slack連携でできること
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  毎日決まった時間に、指定したチャンネルに問題を自動配信
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Slack上でボタンをクリックして回答
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  回答後、即座に正解・不正解と解説を表示
                </li>
                <li className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-500 mr-2 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  連続正答日数やアチーブメントでモチベーション向上
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
