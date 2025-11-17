'use client';

import { useState } from 'react';

interface Hypothesis {
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  actionItems: string[];
  impact: string;
}

interface Anomaly {
  metric: string;
  severity: 'critical' | 'warning' | 'positive';
  changePercent: number;
  currentValue: number;
  previousValue: number;
  dimensions?: {
    channels?: Array<{ dimension: string; changePercent: number; currentValue: number; previousValue: number }>;
    anomalousChannels?: Array<{ dimension: string; changePercent: number }>;
    devices?: Array<{ dimension: string; changePercent: number; currentValue: number; previousValue: number }>;
    anomalousDevices?: Array<{ dimension: string; changePercent: number }>;
  };
}

interface InsightsResponse {
  hasAnomalies: boolean;
  anomalies?: Anomaly[];
  hypotheses?: Hypothesis[];
  message?: string;
  period?: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
}

interface InsightsTabProps {
  propertyId: string | null;
}

export default function InsightsTab({ propertyId }: InsightsTabProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [expandedAnomaly, setExpandedAnomaly] = useState<number | null>(null);
  const [expandedHypothesis, setExpandedHypothesis] = useState<number | null>(null);

  // 日付計算（過去30日 vs その前の30日）
  const calculateDateRanges = () => {
    const today = new Date();
    const currentEnd = new Date(today);
    currentEnd.setDate(currentEnd.getDate() - 1); // 昨日まで

    const currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - 29); // 30日間

    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1); // 前期間の終了

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 29); // 前期間30日間

    return {
      currentStartDate: currentStart.toISOString().split('T')[0],
      currentEndDate: currentEnd.toISOString().split('T')[0],
      previousStartDate: previousStart.toISOString().split('T')[0],
      previousEndDate: previousEnd.toISOString().split('T')[0]
    };
  };

  const analyzeInsights = async () => {
    if (!propertyId) return;

    setLoading(true);
    try {
      const dateRanges = calculateDateRanges();

      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          ...dateRanges
        })
      });

      if (!response.ok) {
        throw new Error('インサイト分析に失敗しました');
      }

      const data: InsightsResponse = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('インサイト分析エラー:', error);
      alert('インサイト分析に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: 'critical' | 'warning' | 'positive') => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-400 text-red-800';
      case 'warning':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'positive':
        return 'bg-green-100 border-green-400 text-green-800';
    }
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'positive') => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'positive':
        return '🟢';
    }
  };

  const getSeverityLabel = (severity: 'critical' | 'warning' | 'positive') => {
    switch (severity) {
      case 'critical':
        return '緊急';
      case 'warning':
        return '注意';
      case 'positive':
        return 'ポジティブ';
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-blue-100 text-blue-800',
      medium: 'bg-gray-100 text-gray-800',
      low: 'bg-gray-50 text-gray-600'
    };
    const labels = {
      high: '確度: 高',
      medium: '確度: 中',
      low: '確度: 低'
    };
    return <span className={`px-2 py-1 rounded text-xs ${colors[confidence]}`}>{labels[confidence]}</span>;
  };

  if (!propertyId) {
    return (
      <div className="text-center py-12 text-gray-500">
        プロパティを選択してください
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">AIインサイト分析</h2>
          <p className="text-sm text-gray-600 mt-1">
            過去30日間のデータから異常検知と改善提案を自動生成します
          </p>
        </div>
        <button
          onClick={analyzeInsights}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '分析中...' : '分析開始'}
        </button>
      </div>

      {/* 分析期間表示 */}
      {insights?.period && (
        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
          <strong>分析期間:</strong> {insights.period.current.start} 〜 {insights.period.current.end} vs{' '}
          {insights.period.previous.start} 〜 {insights.period.previous.end}
        </div>
      )}

      {/* 結果表示 */}
      {insights && (
        <div className="space-y-6">
          {!insights.hasAnomalies ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-800 font-medium">{insights.message}</p>
            </div>
          ) : (
            <>
              {/* 異常検知セクション */}
              <div>
                <h3 className="text-xl font-bold mb-4">検知された異常</h3>
                <div className="space-y-3">
                  {insights.anomalies?.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`border-l-4 rounded-lg p-4 cursor-pointer transition-all ${getSeverityColor(anomaly.severity)}`}
                      onClick={() => setExpandedAnomaly(expandedAnomaly === idx ? null : idx)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getSeverityIcon(anomaly.severity)}</span>
                          <div>
                            <div className="font-bold text-lg">{anomaly.metric}</div>
                            <div className="text-sm">
                              {anomaly.changePercent > 0 ? '+' : ''}
                              {anomaly.changePercent}% の変化
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg">{anomaly.currentValue.toLocaleString()}</div>
                          <div className="text-sm opacity-75">前期: {anomaly.previousValue.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* 詳細情報（展開時） */}
                      {expandedAnomaly === idx && anomaly.dimensions && (
                        <div className="mt-4 pt-4 border-t border-current/20 space-y-3">
                          {/* チャネル別 */}
                          {anomaly.dimensions.channels && (
                            <div>
                              <div className="font-semibold mb-2">📊 チャネル別内訳</div>
                              <div className="space-y-1">
                                {anomaly.dimensions.channels.slice(0, 5).map((ch, chIdx) => (
                                  <div key={chIdx} className="flex justify-between text-sm">
                                    <span>{ch.dimension}</span>
                                    <span className={ch.changePercent < -20 ? 'text-red-600 font-bold' : ch.changePercent > 20 ? 'text-green-600 font-bold' : ''}>
                                      {ch.changePercent > 0 ? '+' : ''}{ch.changePercent}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* デバイス別 */}
                          {anomaly.dimensions.devices && (
                            <div>
                              <div className="font-semibold mb-2">📱 デバイス別内訳</div>
                              <div className="space-y-1">
                                {anomaly.dimensions.devices.map((dev, devIdx) => (
                                  <div key={devIdx} className="flex justify-between text-sm">
                                    <span>{dev.dimension}</span>
                                    <span className={dev.changePercent < -20 ? 'text-red-600 font-bold' : dev.changePercent > 20 ? 'text-green-600 font-bold' : ''}>
                                      {dev.changePercent > 0 ? '+' : ''}{dev.changePercent}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 仮説セクション */}
              {insights.hypotheses && insights.hypotheses.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">💡 AI推定仮説</h3>
                  <div className="space-y-3">
                    {insights.hypotheses.map((hypothesis, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                        onClick={() => setExpandedHypothesis(expandedHypothesis === idx ? null : idx)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">💡</span>
                              <h4 className="font-bold text-lg">{hypothesis.title}</h4>
                              {getConfidenceBadge(hypothesis.confidence)}
                            </div>
                            <p className="text-gray-700 mb-3">{hypothesis.description}</p>
                          </div>
                        </div>

                        {/* 詳細情報（展開時） */}
                        {expandedHypothesis === idx && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            {/* 根拠 */}
                            <div>
                              <div className="font-semibold mb-2 flex items-center gap-2">
                                <span>📋</span> 根拠
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                {hypothesis.evidence.map((e, eIdx) => (
                                  <li key={eIdx}>{e}</li>
                                ))}
                              </ul>
                            </div>

                            {/* 確認方法 */}
                            <div>
                              <div className="font-semibold mb-2 flex items-center gap-2">
                                <span>✅</span> 確認方法
                              </div>
                              <ul className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                                {hypothesis.actionItems.map((action, aIdx) => (
                                  <li key={aIdx}>{action}</li>
                                ))}
                              </ul>
                            </div>

                            {/* 影響範囲 */}
                            <div>
                              <div className="font-semibold mb-2 flex items-center gap-2">
                                <span>📍</span> 影響範囲
                              </div>
                              <p className="text-sm text-gray-700">{hypothesis.impact}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 初期状態 */}
      {!loading && !insights && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">🔍</div>
          <p>「分析開始」ボタンをクリックして、データの異常検知を実行してください</p>
        </div>
      )}
    </div>
  );
}
