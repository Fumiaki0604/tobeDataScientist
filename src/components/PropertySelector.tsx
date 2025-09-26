'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Check, Globe } from 'lucide-react'

interface Property {
  id: string
  name: string
  websiteUrl: string
  accountName: string
  propertyType: string
}

interface PropertySelectorProps {
  onPropertySelected: (propertyId: string) => void
  selectedPropertyId?: string
}

export default function PropertySelector({ onPropertySelected, selectedPropertyId }: PropertySelectorProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(false) // 初期ロード状態をfalseに変更
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isUpdating, setIsUpdating] = useState(false) // バックグラウンド更新用

  useEffect(() => {
    // ローカルストレージからキャッシュされたプロパティを読み込み
    const cachedProperties = localStorage.getItem('ga4-properties-cache')
    if (cachedProperties) {
      try {
        const parsed = JSON.parse(cachedProperties)
        setProperties(parsed)

        // 既に保存されているプロパティIDがあるかチェック
        const savedPropertyId = localStorage.getItem('ga4-property-id')
        if (savedPropertyId) {
          const savedProperty = parsed.find((p: Property) => p.id === savedPropertyId)
          if (savedProperty) {
            setSelectedProperty(savedProperty)
            onPropertySelected(savedPropertyId)
          }
        }
      } catch (e) {
        console.error('Failed to parse cached properties:', e)
      }
    }

    // バックグラウンドでプロパティ一覧を更新
    fetchProperties(true)
  }, []) // fetchPropertiesは内部関数なので依存関係から除外

  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      const property = properties.find(p => p.id === selectedPropertyId)
      if (property) {
        setSelectedProperty(property)
      }
    }
  }, [selectedPropertyId, properties])

  const fetchProperties = async (isBackgroundUpdate = false) => {
    try {
      // バックグラウンド更新の場合はisUpdatingを使用
      if (isBackgroundUpdate) {
        setIsUpdating(true)
      } else {
        setLoading(true)
      }

      const response = await fetch('/api/properties')

      if (!response.ok) {
        throw new Error('プロパティ一覧の取得に失敗しました')
      }

      const result = await response.json()

      if (result.success) {
        setProperties(result.properties)

        // プロパティ一覧をローカルストレージにキャッシュ
        localStorage.setItem('ga4-properties-cache', JSON.stringify(result.properties))

        // 既に保存されているプロパティIDがあるかチェック（初回ロード時のみ）
        if (!isBackgroundUpdate) {
          const savedPropertyId = localStorage.getItem('ga4-property-id')
          if (savedPropertyId) {
            const savedProperty = result.properties.find((p: Property) => p.id === savedPropertyId)
            if (savedProperty) {
              setSelectedProperty(savedProperty)
              onPropertySelected(savedPropertyId)
            }
          }
        }

        // エラーをクリア
        setError('')
      } else {
        throw new Error(result.error || 'プロパティの取得に失敗しました')
      }
    } catch (err) {
      // バックグラウンド更新でエラーが発生した場合は、エラー表示はしない
      if (!isBackgroundUpdate) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました')
      }
    } finally {
      if (isBackgroundUpdate) {
        setIsUpdating(false)
      } else {
        setLoading(false)
      }
    }
  }

  const selectProperty = (property: Property) => {
    setSelectedProperty(property)
    setIsOpen(false)

    // ローカルストレージに保存
    localStorage.setItem('ga4-property-id', property.id)
    localStorage.setItem('ga4-property-name', property.name)

    onPropertySelected(property.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">プロパティ一覧を読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-red-600">プロパティ取得エラー</h1>
          <p className="text-gray-600 mb-4">{error}</p>

          {error.includes('Admin API') && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4 text-sm">
              <p className="font-semibold">API有効化が必要です：</p>
              <p>Google Cloud ConsoleでAnalytics Admin APIを有効化してください</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => fetchProperties(false)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              再試行
            </button>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">または手動でプロパティIDを入力：</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="プロパティID (例: 123456789)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = (e.target as HTMLInputElement).value.trim()
                      if (value) {
                        localStorage.setItem('ga4-property-id', value)
                        localStorage.setItem('ga4-property-name', `プロパティ ${value}`)
                        onPropertySelected(value)
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input')
                    const value = input?.value.trim()
                    if (value) {
                      localStorage.setItem('ga4-property-id', value)
                      localStorage.setItem('ga4-property-name', `プロパティ ${value}`)
                      onPropertySelected(value)
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  設定
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">プロパティが見つかりません</h1>
          <p className="text-gray-600 mb-6">
            このGoogleアカウントに紐づいているGA4プロパティがありません。
            <br />
            Google Analyticsでプロパティが正しく設定されているか確認してください。
          </p>
          <button
            onClick={() => fetchProperties(false)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  if (!selectedProperty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl w-full mx-4">
          <h1 className="text-2xl font-bold mb-4 text-center">GA4プロパティを選択</h1>
          <p className="text-gray-600 mb-6 text-center">
            分析したいGoogle Analytics 4プロパティを選択してください。
          </p>

          <div className="space-y-3">
            {properties.map((property) => (
              <button
                key={property.id}
                onClick={() => selectProperty(property)}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{property.name}</h3>
                    <p className="text-sm text-gray-500">アカウント: {property.accountName}</p>
                    {property.websiteUrl && (
                      <div className="flex items-center mt-1">
                        <Globe className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-500">{property.websiteUrl}</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">プロパティID: {property.id}</p>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 選択済みの場合は小さなセレクターを表示
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">{selectedProperty.name}</div>
          <div className="text-xs text-gray-500">ID: {selectedProperty.id}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => selectProperty(property)}
              className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{property.name}</div>
                  <div className="text-xs text-gray-500">ID: {property.id}</div>
                  <div className="text-xs text-gray-400">{property.accountName}</div>
                </div>
                {selectedProperty?.id === property.id && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}