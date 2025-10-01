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
    analysisType: z.enum(['simple_query', 'comparison', 'ranking', 'trend', 'device_breakdown']),
    filters: z.array(z.any()).optional(),
});
export class QueryAnalyzer {
    // 時間関連のキーワードパターン
    timePatterns = {
        '先週': { type: 'relative', period: 'last_week' },
        '今週': { type: 'relative', period: 'this_week' },
        '先月': { type: 'relative', period: 'last_month' },
        '今月': { type: 'relative', period: 'this_month' },
        '昨日': { type: 'relative', period: 'yesterday' },
        '今日': { type: 'relative', period: 'today' },
        '過去7日': { type: 'relative', period: 'last_7_days' },
        '過去30日': { type: 'relative', period: 'last_30_days' },
        '9月': { type: 'named', period: '9月' },
        '8月': { type: 'named', period: '8月' },
        '10月': { type: 'named', period: '10月' },
    };
    // メトリクスのキーワードパターン
    metricPatterns = {
        '売上': ['totalRevenue'],
        '収益': ['totalRevenue'],
        'revenue': ['totalRevenue'],
        'PV': ['screenPageViews'],
        'ページビュー': ['screenPageViews'],
        'pageview': ['screenPageViews'],
        'ユーザー': ['activeUsers'],
        'user': ['activeUsers'],
        'セッション': ['sessions'],
        'session': ['sessions'],
        'トランザクション': ['transactions'],
        'transaction': ['transactions'],
        '購入': ['transactions'],
        'コンバージョン': ['transactions'],
    };
    // ディメンションのキーワードパターン
    dimensionPatterns = {
        'デバイス': ['deviceCategory'],
        'device': ['deviceCategory'],
        'ページ': ['pagePath', 'pageTitle'],
        'page': ['pagePath', 'pageTitle'],
        'チャネル': ['sessionDefaultChannelGrouping'],
        'channel': ['sessionDefaultChannelGrouping'],
        'ソース': ['sessionSource'],
        'source': ['sessionSource'],
        '日別': ['date'],
        '推移': ['date'],
        'トレンド': ['date'],
        'trend': ['date'],
    };
    async analyzeQuery(question, propertyId) {
        console.log(`[QueryAnalyzer] Analyzing: "${question}"`);
        // 1. 時間範囲の解析
        const timeframe = this.extractTimeframe(question);
        // 2. メトリクスの抽出
        const metrics = this.extractMetrics(question);
        // 3. ディメンションの抽出
        const dimensions = this.extractDimensions(question);
        // 4. 分析タイプの判定
        const analysisType = this.determineAnalysisType(question);
        const config = {
            timeframe,
            metrics: metrics.length > 0 ? metrics : ['screenPageViews'], // デフォルト
            dimensions: dimensions.length > 0 ? dimensions : [], // デフォルトは空
            analysisType,
        };
        console.log(`[QueryAnalyzer] Result:`, JSON.stringify(config, null, 2));
        return config;
    }
    extractTimeframe(question) {
        // 具体的な日付パターンの検索（YYYY/M/D, YYYY-M-D, M/D など）
        const datePatterns = [
            /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?/, // 2025/9/27, 2025-9-27, 2025年9月27日
            /(\d{1,2})[\/\-月](\d{1,2})日?/, // 9/27, 9月27日
        ];
        for (const pattern of datePatterns) {
            const match = question.match(pattern);
            if (match) {
                let year, month, day;
                if (match[0].includes('年') || match[1]?.length === 4) {
                    // YYYY/M/D 形式
                    year = parseInt(match[1]);
                    month = parseInt(match[2]);
                    day = parseInt(match[3]);
                }
                else {
                    // M/D 形式（年は現在年を使用）
                    const currentYear = new Date().getFullYear();
                    year = currentYear;
                    month = parseInt(match[1]);
                    day = parseInt(match[2]);
                }
                const targetDate = new Date(year, month - 1, day);
                const dateStr = this.formatDate(targetDate);
                return {
                    type: 'absolute',
                    startDate: dateStr,
                    endDate: dateStr,
                };
            }
        }
        // 時間キーワードの検索
        for (const [keyword, pattern] of Object.entries(this.timePatterns)) {
            if (question.includes(keyword)) {
                return {
                    type: pattern.type,
                    period: pattern.period,
                };
            }
        }
        // デフォルトは過去7日間
        return {
            type: 'relative',
            period: 'last_7_days',
        };
    }
    extractMetrics(question) {
        const extractedMetrics = [];
        for (const [keyword, metrics] of Object.entries(this.metricPatterns)) {
            if (question.toLowerCase().includes(keyword.toLowerCase())) {
                extractedMetrics.push(...metrics);
            }
        }
        // 重複除去
        return [...new Set(extractedMetrics)];
    }
    extractDimensions(question) {
        const extractedDimensions = [];
        for (const [keyword, dimensions] of Object.entries(this.dimensionPatterns)) {
            if (question.toLowerCase().includes(keyword.toLowerCase())) {
                extractedDimensions.push(...dimensions);
            }
        }
        // 重複除去
        return [...new Set(extractedDimensions)];
    }
    determineAnalysisType(question) {
        const lowerQuestion = question.toLowerCase();
        if (lowerQuestion.includes('比較') || lowerQuestion.includes('vs') || lowerQuestion.includes('対')) {
            return 'comparison';
        }
        if (lowerQuestion.includes('ランキング') || lowerQuestion.includes('順位') || lowerQuestion.includes('トップ') || lowerQuestion.includes('最も')) {
            return 'ranking';
        }
        if (lowerQuestion.includes('推移') || lowerQuestion.includes('変化') || lowerQuestion.includes('トレンド') || lowerQuestion.includes('傾向')) {
            return 'trend';
        }
        if (lowerQuestion.includes('デバイス') || lowerQuestion.includes('device')) {
            return 'device_breakdown';
        }
        return 'simple_query';
    }
    // 日付範囲の計算
    calculateDateRange(timeframe) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        // 絶対日付の場合は直接返す
        if (timeframe.type === 'absolute' && timeframe.startDate && timeframe.endDate) {
            return {
                startDate: timeframe.startDate,
                endDate: timeframe.endDate,
            };
        }
        if (timeframe.type === 'named') {
            return this.handleNamedPeriod(timeframe.period, today);
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
    handleNamedPeriod(period, today) {
        const monthNames = {
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
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
}
//# sourceMappingURL=query-analyzer.js.map