import { z } from 'zod';

// 分析設定の型定義
export const AnalysisConfigSchema = z.object({
  timeframe: z.object({
    type: z.enum(['relative', 'absolute', 'named']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    period: z.string().optional(),
  }),
  metrics: z.array(z.string()),
  dimensions: z.array(z.string()),
  analysisType: z.enum(['simple_query', 'comparison', 'ranking', 'trend', 'device_breakdown', 'period_comparison']),
  filters: z.array(z.any()).optional(),
});

export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;

export class QueryAnalyzer {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // 頻出パターンのプリセット（5-10個程度に厳選）
  private quickPatterns = {
    // パターン1: デバイス別セッション
    deviceSessions: {
      pattern: /デバイス別.*セッション|セッション.*デバイス/i,
      config: {
        timeframe: { type: 'relative' as const, period: 'last_week' },
        metrics: ['sessions'],
        dimensions: ['deviceCategory'],
        analysisType: 'device_breakdown' as const
      }
    },

    // パターン2: PV系の質問
    pageviews: {
      pattern: /(先週|今週|昨日|今日).*PV|(先週|今週|昨日|今日).*ページビュー/i,
      config: {
        timeframe: { type: 'relative' as const, period: 'last_week' },
        metrics: ['screenPageViews'],
        dimensions: [],
        analysisType: 'simple_query' as const
      }
    },

    // パターン3: ランキング系
    ranking: {
      pattern: /(ランキング|順位|トップ).*PV|(ランキング|順位|トップ).*ページビュー/i,
      config: {
        timeframe: { type: 'relative' as const, period: 'last_30_days' },
        metrics: ['screenPageViews'],
        dimensions: ['pagePath'],
        analysisType: 'ranking' as const
      }
    },

    // パターン4: 売上系
    revenue: {
      pattern: /(先週|先月|今月).*売上|(先週|先月|今月).*収益/i,
      config: {
        timeframe: { type: 'relative' as const, period: 'last_month' },
        metrics: ['totalRevenue'],
        dimensions: [],
        analysisType: 'simple_query' as const
      }
    },

    // パターン5: デバイス別 + 割合
    devicePercentage: {
      pattern: /デバイス別.*割合|割合.*デバイス/i,
      config: {
        timeframe: { type: 'relative' as const, period: 'last_week' },
        metrics: ['sessions'],
        dimensions: ['deviceCategory'],
        analysisType: 'device_breakdown' as const
      }
    }
  };

  async analyzeQuery(question: string, propertyId: string): Promise<AnalysisConfig> {
    console.log(`[QueryAnalyzer] Analyzing: "${question}"`);

    // 完全LLMベースの分析
    console.log(`[QueryAnalyzer] 🤖 Using LLM analysis...`);
    return await this.llmAnalyze(question);
  }

  // 期間比較用に2つの期間を抽出
  async extractComparisonPeriods(question: string): Promise<any> {
    const prompt = `質問から比較する2つの期間を抽出してJSONで返してください：

質問: "${question}"

以下のフォーマットで正確なJSONのみを返してください：
{
  "period1": {
    "label": "先月",
    "type": "relative_month",
    "offset": -1
  },
  "period2": {
    "label": "今月",
    "type": "relative_month",
    "offset": 0
  }
}

指定可能なtype:
- "relative_month": 相対的な月（offset: 0=今月, -1=先月, -2=先々月）
- "relative_week": 相対的な週（offset: 0=今週, -1=先週, -2=先々週）
- "relative_day": 相対的な日（offset: 0=今日, -1=昨日, -2=一昨日）
- "named_month": 特定の月名（label: "9月", "8月"など）

例:
- "先月と今月を比較" → period1: {label: "先月", type: "relative_month", offset: -1}, period2: {label: "今月", type: "relative_month", offset: 0}
- "先月と先々月を比較" → period1: {label: "先々月", type: "relative_month", offset: -2}, period2: {label: "先月", type: "relative_month", offset: -1}
- "9月と8月を比較" → period1: {label: "8月", type: "named_month"}, period2: {label: "9月", type: "named_month"}
- "先週と今週" → period1: {label: "先週", type: "relative_week", offset: -1}, period2: {label: "今週", type: "relative_week", offset: 0}

JSONのみ返してください。説明は不要です。`;

    try {
      const response = await this.callOpenAI(prompt);
      const periods = JSON.parse(response);
      console.log(`[QueryAnalyzer] ✅ Extracted periods:`, JSON.stringify(periods, null, 2));
      return periods;
    } catch (error) {
      console.error(`[QueryAnalyzer] ❌ Period extraction failed:`, error);
      // デフォルト: 先月 vs 今月
      return {
        period1: { label: '先月', type: 'relative_month', offset: -1 },
        period2: { label: '今月', type: 'relative_month', offset: 0 }
      };
    }
  }

  private tryQuickPatterns(question: string): { matched: boolean; patternName?: string; config?: AnalysisConfig } {
    for (const [name, pattern] of Object.entries(this.quickPatterns)) {
      if (pattern.pattern.test(question)) {
        return {
          matched: true,
          patternName: name,
          config: JSON.parse(JSON.stringify(pattern.config)) // Deep copy
        };
      }
    }
    return { matched: false };
  }

  private adjustTimeframe(config: AnalysisConfig, question: string): AnalysisConfig {
    // 質問から具体的な時間を抽出してconfigを調整
    if (question.includes('先週')) {
      config.timeframe = { type: 'relative', period: 'last_week' };
    } else if (question.includes('今週')) {
      config.timeframe = { type: 'relative', period: 'this_week' };
    } else if (question.includes('先月')) {
      config.timeframe = { type: 'relative', period: 'last_month' };
    } else if (question.includes('今月')) {
      config.timeframe = { type: 'relative', period: 'this_month' };
    } else if (question.includes('昨日')) {
      config.timeframe = { type: 'relative', period: 'yesterday' };
    } else if (question.includes('今日')) {
      config.timeframe = { type: 'relative', period: 'today' };
    }

    return config;
  }

  private async llmAnalyze(question: string): Promise<AnalysisConfig> {
    const prompt = `GA4分析質問を解析してJSONで回答してください：

質問: "${question}"

以下のフォーマットで正確なJSONのみを返してください：
{
  "timeframe": {"type": "relative", "period": "last_week"},
  "metrics": ["totalRevenue"],
  "dimensions": ["deviceCategory"],
  "analysisType": "simple_query"
}

指定可能な値:
- timeframe.type: "relative", "absolute", "named"
- timeframe.period: "today", "yesterday", "last_week", "this_week", "last_month", "this_month", "last_7_days", "last_30_days", "9月", "8月", "10月"
- metrics: "totalRevenue", "sessions", "screenPageViews", "activeUsers", "transactions"
- dimensions: "deviceCategory", "pagePath", "pageTitle", "sessionDefaultChannelGrouping", "date", または空配列
- analysisType: "simple_query", "comparison", "ranking", "trend", "device_breakdown", "period_comparison"

ガイドライン:
- 売上/収益/revenue/売り上げ → "totalRevenue"
- PV/ページビュー/閲覧/page view → "screenPageViews"
- ユーザー/訪問者/user → "activeUsers"
- セッション/session → "sessions"
- 購入/トランザクション/コンバージョン → "transactions"
- デバイス/device → dimensions: ["deviceCategory"]
- ページ/page → dimensions: ["pagePath"]
- チャネル/channel → dimensions: ["sessionDefaultChannelGrouping"]
- ランキング/順位/トップ → "ranking"
- 比較/vs/対比 → "comparison"
- 推移/変化/トレンド → "trend"
- 期間比較（先月vs今月） → "period_comparison"

JSONのみ返してください。説明は不要です。`;

    try {
      const response = await this.callOpenAI(prompt);
      console.log(`[QueryAnalyzer] 🤖 LLM response:`, response);

      const config = JSON.parse(response);
      console.log(`[QueryAnalyzer] ✅ LLM analysis result:`, JSON.stringify(config, null, 2));

      return config;
    } catch (error) {
      console.error(`[QueryAnalyzer] ❌ LLM analysis failed:`, error);

      // フォールバック設定
      return {
        timeframe: { type: 'relative', period: 'last_week' },
        metrics: ['screenPageViews'],
        dimensions: [],
        analysisType: 'simple_query'
      };
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices[0].message.content.trim();
  }


  // 期間情報を日付範囲に変換
  calculateDateRangeFromPeriod(period: any): { startDate: string; endDate: string } {
    const today = new Date();

    switch (period.type) {
      case 'relative_month': {
        const targetMonth = new Date(today.getFullYear(), today.getMonth() + period.offset, 1);
        const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
        const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

        // offset=0（今月）の場合、endDateは今日まで
        if (period.offset === 0) {
          return {
            startDate: this.formatDate(monthStart),
            endDate: this.formatDate(today)
          };
        }

        return {
          startDate: this.formatDate(monthStart),
          endDate: this.formatDate(monthEnd)
        };
      }

      case 'relative_week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + (period.offset * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // offset=0（今週）の場合、endDateは今日まで
        if (period.offset === 0) {
          return {
            startDate: this.formatDate(weekStart),
            endDate: this.formatDate(today)
          };
        }

        return {
          startDate: this.formatDate(weekStart),
          endDate: this.formatDate(weekEnd)
        };
      }

      case 'relative_day': {
        const targetDay = new Date(today);
        targetDay.setDate(today.getDate() + period.offset);
        return {
          startDate: this.formatDate(targetDay),
          endDate: this.formatDate(targetDay)
        };
      }

      case 'named_month': {
        const monthNames: Record<string, number> = {
          '1月': 0, '2月': 1, '3月': 2, '4月': 3, '5月': 4, '6月': 5,
          '7月': 6, '8月': 7, '9月': 8, '10月': 9, '11月': 10, '12月': 11
        };

        const monthIndex = monthNames[period.label];
        if (monthIndex !== undefined) {
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();

          let targetYear = currentYear;
          if (monthIndex > currentMonth) {
            targetYear = currentYear - 1;
          }

          const monthStart = new Date(targetYear, monthIndex, 1);
          const monthEnd = new Date(targetYear, monthIndex + 1, 0);

          return {
            startDate: this.formatDate(monthStart),
            endDate: this.formatDate(monthEnd)
          };
        }
      }
    }

    // フォールバック
    return {
      startDate: this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: this.formatDate(today)
    };
  }

  // 日付範囲の計算
  calculateDateRange(timeframe: AnalysisConfig['timeframe']): { startDate: string; endDate: string } {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (timeframe.type === 'named') {
      return this.handleNamedPeriod(timeframe.period!, today);
    }

    switch (timeframe.period) {
      case 'today':
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(today),
        };

      case 'yesterday':
        return {
          startDate: this.formatDate(yesterday),
          endDate: this.formatDate(yesterday),
        };

      case 'last_7_days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return {
          startDate: this.formatDate(sevenDaysAgo),
          endDate: this.formatDate(today),
        };

      case 'last_30_days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return {
          startDate: this.formatDate(thirtyDaysAgo),
          endDate: this.formatDate(today),
        };

      case 'last_week':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        return {
          startDate: this.formatDate(lastWeekStart),
          endDate: this.formatDate(lastWeekEnd),
        };

      case 'this_week':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        return {
          startDate: this.formatDate(thisWeekStart),
          endDate: this.formatDate(today),
        };

      case 'last_month':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: this.formatDate(lastMonth),
          endDate: this.formatDate(lastMonthEnd),
        };

      case 'this_month':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: this.formatDate(thisMonthStart),
          endDate: this.formatDate(today),
        };

      default:
        // デフォルトは過去7日間
        const defaultStart = new Date(today);
        defaultStart.setDate(today.getDate() - 7);
        return {
          startDate: this.formatDate(defaultStart),
          endDate: this.formatDate(today),
        };
    }
  }

  private handleNamedPeriod(period: string, today: Date): { startDate: string; endDate: string } {
    const monthNames: Record<string, number> = {
      '1月': 0, '2月': 1, '3月': 2, '4月': 3, '5月': 4, '6月': 5,
      '7月': 6, '8月': 7, '9月': 8, '10月': 9, '11月': 10, '12月': 11
    };

    const monthIndex = monthNames[period];
    if (monthIndex !== undefined) {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let targetYear = currentYear;
      if (monthIndex > currentMonth) {
        targetYear = currentYear - 1;
      }

      const monthStart = new Date(targetYear, monthIndex, 1);
      const monthEnd = new Date(targetYear, monthIndex + 1, 0);

      return {
        startDate: this.formatDate(monthStart),
        endDate: this.formatDate(monthEnd),
      };
    }

    // フォールバック
    const defaultStart = new Date(today);
    defaultStart.setDate(today.getDate() - 7);
    return {
      startDate: this.formatDate(defaultStart),
      endDate: this.formatDate(today),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}