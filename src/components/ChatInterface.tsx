'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  propertyId: string
}

export default function ChatInterface({ propertyId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'こんにちは！Google Analytics 4の分析についてお聞きください。「昨日と今日のPV数を比較してください」のような質問をお待ちしています。',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const previousPropertyIdRef = useRef<string>(propertyId)

  // プロパティIDが変更されたときのみ履歴をクリア
  useEffect(() => {
    if (previousPropertyIdRef.current !== propertyId) {
      console.log(`Property changed from ${previousPropertyIdRef.current} to ${propertyId}, clearing chat history`)
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'こんにちは！Google Analytics 4の分析についてお聞きください。「昨日と今日のPV数を比較してください」のような質問をお待ちしています。',
          timestamp: new Date()
        }
      ])
      previousPropertyIdRef.current = propertyId
    }
  }, [propertyId])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // 会話履歴を含めて送信（最初のウェルカムメッセージは除く）
      const conversationHistory = messages
        .filter(msg => msg.id !== '1') // ウェルカムメッセージを除外
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          propertyId: propertyId,
          conversationHistory: conversationHistory
        }),
      })

      if (!response.ok) {
        throw new Error('分析の実行に失敗しました')
      }

      const result = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.success ? result.response : result.error || 'エラーが発生しました',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error: any) {
      let errorContent = 'すみません、分析中にエラーが発生しました。もう一度試してください。'

      // 認証エラーの場合
      if (error?.status === 401 || error?.needsReauth) {
        errorContent = '認証の有効期限が切れました。ページを更新してもう一度ログインしてください。'
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col" style={{ height: '600px' }}>
      {/* チャットヘッダー */}
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-900">GA4 分析チャット</h2>
        <p className="text-sm text-gray-900">データについて自然言語で質問してください</p>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* アバター */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-900'
            }`}>
              {message.role === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>

            {/* メッセージバブル */}
            <div className={`flex-1 max-w-3xl ${
              message.role === 'user' ? 'text-right' : ''
            }`}>
              <div className={`inline-block p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
              <div className="text-xs text-gray-900 mt-1">
                {message.timestamp.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}

        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-900 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 max-w-3xl">
              <div className="inline-block p-3 rounded-lg bg-gray-100">
                <div className="flex items-center gap-2 text-gray-900">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>分析中...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 入力フォーム */}
      <div className="p-4 border-t bg-gray-50 rounded-b-lg">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="例: 昨日と今日のPV数を比較してください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-10 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center h-10"
            title="送信"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* 使用例 */}
        <div className="mt-3">
          <p className="text-xs text-gray-900 mb-2">質問例:</p>
          <div className="flex flex-wrap gap-2">
            {[
              '昨日と今日のPV数を比較してください',
              '先週のユーザー数はどのくらいですか？',
              'セッション数の傾向を教えてください',
              '過去30日間の分析をお願いします',
              '前年同月と直近一ヶ月から今月のユーザー数を予測してください',
              '先月と今月でデバイス別の訪問者数を比較してください'
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(example)}
                className="text-xs px-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-gray-900"
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}