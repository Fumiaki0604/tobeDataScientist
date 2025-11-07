import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { runReport } from '@/mcp-modules/ga4-client';
import { detectAnomaly, findAnomalousDimensions, rankAnomalies, type Anomaly, type DimensionData } from '@/utils/anomaly-detector';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

interface InsightRequest {
  propertyId: string;
  currentStartDate: string;
  currentEndDate: string;
  previousStartDate: string;
  previousEndDate: string;
}

/**
 * GA4データから異常検知とAI仮説生成を実行
 * POST /api/insights
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body: InsightRequest = await request.json();
    const { propertyId, currentStartDate, currentEndDate, previousStartDate, previousEndDate } = body;

    console.log('📊 インサイト分析開始:', { propertyId, currentStartDate, currentEndDate });

    // 1. 基本メトリクスの取得（現在期間 vs 前期間）
    const [currentMetrics, previousMetrics] = await Promise.all([
      runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'transactions' },
          { name: 'totalRevenue' },
          { name: 'activeUsers' }
        ]
      }, session.accessToken),
      runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: previousStartDate, endDate: previousEndDate }],
        dimensions: [],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'transactions' },
          { name: 'totalRevenue' },
          { name: 'activeUsers' }
        ]
      }, session.accessToken)
    ]);

    // メトリクス異常検知
    const anomalies: Anomaly[] = [];
    const metricNames = ['sessions', 'screenPageViews', 'transactions', 'totalRevenue', 'activeUsers'];
    const metricLabels: Record<string, string> = {
      sessions: 'セッション数',
      screenPageViews: 'ページビュー数',
      transactions: 'トランザクション数',
      totalRevenue: '売上',
      activeUsers: 'アクティブユーザー数'
    };

    for (let i = 0; i < metricNames.length; i++) {
      const metricName = metricNames[i];
      const current = parseFloat(currentMetrics[0]?.[metricName] || '0');
      const previous = parseFloat(previousMetrics[0]?.[metricName] || '0');

      const anomalyCheck = detectAnomaly(current, previous);

      if (anomalyCheck.isAnomaly) {
        anomalies.push({
          metric: metricLabels[metricName],
          severity: anomalyCheck.severity,
          changePercent: anomalyCheck.changePercent,
          currentValue: current,
          previousValue: previous,
          detectedAt: new Date().toISOString()
        });
      }
    }

    console.log(`🔍 ${anomalies.length}件の異常を検知`);

    // 異常が検出されなかった場合
    if (anomalies.length === 0) {
      return NextResponse.json({
        hasAnomalies: false,
        message: '異常は検出されませんでした。すべてのメトリクスが正常範囲内です。'
      });
    }

    // 2. 異常が検出された場合、多次元ドリルダウン分析
    const detailedAnomalies = await Promise.all(
      anomalies.slice(0, 3).map(async (anomaly) => {
        // チャネル別分析
        const [currentChannel, previousChannel] = await Promise.all([
          runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
            dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
            metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }]
          }, session.accessToken),
          runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: previousStartDate, endDate: previousEndDate }],
            dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
            metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }]
          }, session.accessToken)
        ]);

        // チャネル別データ整形
        const channelData: DimensionData[] = currentChannel.map(curr => {
          const channel = curr.sessionDefaultChannelGrouping;
          const prev = previousChannel.find(p => p.sessionDefaultChannelGrouping === channel);
          const currentValue = parseFloat(curr.sessions || '0');
          const previousValue = parseFloat(prev?.sessions || '0');
          const change = currentValue - previousValue;
          const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

          return {
            dimension: channel,
            currentValue,
            previousValue,
            change,
            changePercent: Math.round(changePercent * 10) / 10
          };
        });

        // 異常なチャネルを検出
        const anomalousChannels = findAnomalousDimensions(channelData);

        // デバイス別分析
        const [currentDevice, previousDevice] = await Promise.all([
          runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }]
          }, session.accessToken),
          runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: previousStartDate, endDate: previousEndDate }],
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'sessions' }, { name: 'totalRevenue' }]
          }, session.accessToken)
        ]);

        // デバイス別データ整形
        const deviceData: DimensionData[] = currentDevice.map(curr => {
          const device = curr.deviceCategory;
          const prev = previousDevice.find(p => p.deviceCategory === device);
          const currentValue = parseFloat(curr.sessions || '0');
          const previousValue = parseFloat(prev?.sessions || '0');
          const change = currentValue - previousValue;
          const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

          return {
            dimension: device,
            currentValue,
            previousValue,
            change,
            changePercent: Math.round(changePercent * 10) / 10
          };
        });

        const anomalousDevices = findAnomalousDimensions(deviceData);

        return {
          ...anomaly,
          dimensions: {
            channels: channelData,
            anomalousChannels,
            devices: deviceData,
            anomalousDevices
          }
        };
      })
    );

    // 3. OpenAI で仮説生成
    const hypotheses = await generateHypotheses(detailedAnomalies, {
      currentStartDate,
      currentEndDate,
      previousStartDate,
      previousEndDate
    });

    // 異常を重要度でランキング
    const rankedAnomalies = rankAnomalies(detailedAnomalies);

    return NextResponse.json({
      hasAnomalies: true,
      anomalies: rankedAnomalies,
      hypotheses,
      period: {
        current: { start: currentStartDate, end: currentEndDate },
        previous: { start: previousStartDate, end: previousEndDate }
      }
    });

  } catch (error) {
    console.error('インサイト分析エラー:', error);
    return NextResponse.json(
      { error: 'インサイト分析に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * OpenAI GPT-4oで仮説を生成
 */
async function generateHypotheses(anomalies: any[], period: any) {
  const prompt = `
あなたはWebサイト分析のエキスパートです。以下のGA4データから異常の原因仮説を最大3つ提示してください。

## 分析期間
- 現在期間: ${period.currentStartDate} 〜 ${period.currentEndDate}
- 前期間: ${period.previousStartDate} 〜 ${period.previousEndDate}

## 検知された異常

${anomalies.map((anomaly, idx) => `
### 異常${idx + 1}: ${anomaly.metric}
- 変化: ${anomaly.changePercent > 0 ? '+' : ''}${anomaly.changePercent}%
- 現在値: ${anomaly.currentValue.toLocaleString()}
- 前期値: ${anomaly.previousValue.toLocaleString()}
- 深刻度: ${anomaly.severity === 'critical' ? '緊急' : anomaly.severity === 'warning' ? '注意' : 'ポジティブ'}

#### チャネル別内訳（上位5件）:
${anomaly.dimensions?.channels?.slice(0, 5).map((ch: DimensionData) =>
  `- ${ch.dimension}: ${ch.changePercent > 0 ? '+' : ''}${ch.changePercent}% (${ch.currentValue.toLocaleString()} vs ${ch.previousValue.toLocaleString()})`
).join('\n') || 'データなし'}

${anomaly.dimensions?.anomalousChannels?.length > 0 ? `
⚠️ 異常なチャネル:
${anomaly.dimensions.anomalousChannels.map((ch: DimensionData) =>
  `- ${ch.dimension}: ${ch.changePercent > 0 ? '+' : ''}${ch.changePercent}%`
).join('\n')}
` : ''}

#### デバイス別内訳:
${anomaly.dimensions?.devices?.map((dev: DimensionData) =>
  `- ${dev.dimension}: ${dev.changePercent > 0 ? '+' : ''}${dev.changePercent}% (${dev.currentValue.toLocaleString()} vs ${dev.previousValue.toLocaleString()})`
).join('\n') || 'データなし'}

${anomaly.dimensions?.anomalousDevices?.length > 0 ? `
⚠️ 異常なデバイス:
${anomaly.dimensions.anomalousDevices.map((dev: DimensionData) =>
  `- ${dev.dimension}: ${dev.changePercent > 0 ? '+' : ''}${dev.changePercent}%`
).join('\n')}
` : ''}
`).join('\n')}

## 出力形式（JSON）

必ず以下のJSON形式で出力してください。テキストの説明は不要です。

\`\`\`json
{
  "hypotheses": [
    {
      "title": "仮説のタイトル（30文字以内、具体的に）",
      "description": "仮説の詳細説明（100文字程度）",
      "confidence": "high" | "medium" | "low",
      "evidence": ["根拠1", "根拠2", "根拠3"],
      "actionItems": ["確認方法1", "確認方法2", "確認方法3"],
      "impact": "影響範囲の説明（50文字程度）"
    }
  ]
}
\`\`\`

## 重要な指示
1. 最も確からしい仮説から順に並べてください
2. 各仮説は具体的かつ実行可能な内容にしてください
3. 「〜の可能性」ではなく断定形で記載してください
4. 必ずJSON形式のみを出力してください
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'あなたはWebサイト分析のエキスパートです。データから具体的で実行可能な仮説を提示します。必ずJSON形式のみで回答してください。'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI response is empty');
    }

    const result = JSON.parse(content);
    console.log(`💡 ${result.hypotheses?.length || 0}件の仮説を生成`);
    return result.hypotheses || [];

  } catch (error) {
    console.error('OpenAI仮説生成エラー:', error);
    // フォールバック: 基本的な仮説を返す
    return [
      {
        title: '技術的な問題が発生している可能性',
        description: '特定のデバイスやチャネルで大きな変化が見られます。サイトの動作確認を推奨します。',
        confidence: 'medium',
        evidence: ['特定のディメンションで異常が集中'],
        actionItems: ['サイトの動作確認', 'エラーログの確認'],
        impact: '検出された異常メトリクスに影響'
      }
    ];
  }
}
