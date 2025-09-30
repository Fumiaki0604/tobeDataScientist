export class DataProcessor {
  async processData(data: any, question: string, analysisType: string): Promise<string> {
    console.log(`[DataProcessor] Processing ${analysisType} analysis for: "${question}"`);

    // 期間比較の場合、データ構造が異なる
    if (analysisType === 'period_comparison' && data.period1 && data.period2) {
      return this.processPeriodComparison(data, question);
    }

    // 通常のデータ配列の場合
    if (!Array.isArray(data) || data.length === 0) {
      return 'データが見つかりませんでした。';
    }

    console.log(`[DataProcessor] Data points: ${data.length}`);

    // 複合パターンの検出と処理
    const compositePattern = this.detectCompositePattern(question, analysisType);
    if (compositePattern) {
      return this.processCompositePattern(data, question, compositePattern);
    }

    // 単一パターンの処理
    switch (analysisType) {
      case 'simple_query':
        return this.processSimpleQuery(data, question);

      case 'ranking':
        return this.processRanking(data, question);

      case 'comparison':
        return this.processComparison(data, question);

      case 'trend':
        return this.processTrend(data, question);

      case 'device_breakdown':
        return this.processDeviceBreakdown(data, question);

      default:
        return this.processSimpleQuery(data, question);
    }
  }

  private processSimpleQuery(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    // メトリクスを特定（数値型のキー）
    const metrics = keys.filter(key => typeof firstItem[key] === 'number');

    if (metrics.length === 0) {
      return 'メトリクスデータが見つかりませんでした。';
    }

    // 主要メトリクスの合計を計算
    const totals: Record<string, number> = {};
    metrics.forEach(metric => {
      totals[metric] = data.reduce((sum, item) => sum + (item[metric] || 0), 0);
    });

    // 質問内容に応じて適切なメトリクスを選択
    const relevantMetric = this.selectRelevantMetric(question, metrics);
    const total = totals[relevantMetric];

    return this.formatMetricResponse(relevantMetric, total, question);
  }

  private formatMetricResponse(metric: string, value: number, question: string): string {
    const displayName = this.getMetricDisplayName(metric);
    const formattedValue = this.formatNumber(value, metric);

    return `${displayName}: ${formattedValue}`;
  }

  // 複合パターン検出（軽量な文字列マッチング）
  private detectCompositePattern(question: string, analysisType: string): string | null {
    const lowerQuestion = question.toLowerCase();

    // パターン1: デバイス別 + 割合
    if (analysisType === 'device_breakdown' &&
        (lowerQuestion.includes('割合') || lowerQuestion.includes('パーセント') || lowerQuestion.includes('%'))) {
      return 'device_breakdown_with_percentage';
    }

    // パターン2: ランキング + 成長率
    if (analysisType === 'ranking' &&
        (lowerQuestion.includes('成長') || lowerQuestion.includes('増加') || lowerQuestion.includes('変化'))) {
      return 'ranking_with_growth';
    }

    // パターン3: チャネル別 + コンバージョン率
    if ((lowerQuestion.includes('チャネル') || lowerQuestion.includes('channel')) &&
        (lowerQuestion.includes('コンバージョン') || lowerQuestion.includes('conversion'))) {
      return 'channel_with_conversion';
    }

    // パターン4: 比較 + 差分
    if (analysisType === 'comparison' &&
        (lowerQuestion.includes('差分') || lowerQuestion.includes('違い') || lowerQuestion.includes('差'))) {
      return 'comparison_with_difference';
    }

    // パターン5: トレンド + 予測
    if (analysisType === 'trend' &&
        (lowerQuestion.includes('予測') || lowerQuestion.includes('今後') || lowerQuestion.includes('将来'))) {
      return 'trend_with_forecast';
    }

    return null;
  }

  // 複合パターン処理
  private processCompositePattern(data: any[], question: string, pattern: string): string {
    switch (pattern) {
      case 'device_breakdown_with_percentage':
        return this.deviceBreakdownWithPercentage(data, question);

      case 'ranking_with_growth':
        return this.rankingWithGrowth(data, question);

      case 'channel_with_conversion':
        return this.channelWithConversion(data, question);

      case 'comparison_with_difference':
        return this.comparisonWithDifference(data, question);

      case 'trend_with_forecast':
        return this.trendWithForecast(data, question);

      default:
        return this.processDeviceBreakdown(data, question);
    }
  }

  private processRanking(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    // メトリクスとディメンションを分離
    const metrics = keys.filter(key => typeof firstItem[key] === 'number');
    const dimensions = keys.filter(key => typeof firstItem[key] === 'string');

    if (metrics.length === 0 || dimensions.length === 0) {
      return 'ランキング分析に必要なデータが不足しています。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);
    const relevantDimension = dimensions[0]; // 最初のディメンションを使用

    // メトリクス値でソート
    const sorted = data.sort((a, b) => (b[relevantMetric] || 0) - (a[relevantMetric] || 0));
    const top5 = sorted.slice(0, 5);

    let result = `${this.getMetricDisplayName(relevantMetric)}のランキング（上位5位）:\n\n`;

    top5.forEach((item, index) => {
      const dimensionValue = item[relevantDimension] || 'その他';
      const metricValue = this.formatNumber(item[relevantMetric] || 0, relevantMetric);
      result += `${index + 1}位: ${dimensionValue} - ${metricValue}\n`;
    });

    return result;
  }

  private processComparison(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    const metrics = keys.filter(key => typeof firstItem[key] === 'number');
    const dimensions = keys.filter(key => typeof firstItem[key] === 'string');

    if (metrics.length === 0 || dimensions.length === 0) {
      return '比較分析に必要なデータが不足しています。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);
    const relevantDimension = dimensions[0];

    // ディメンション別に集計
    const aggregated: Record<string, number> = {};
    data.forEach(item => {
      const dimValue = item[relevantDimension] || 'その他';
      aggregated[dimValue] = (aggregated[dimValue] || 0) + (item[relevantMetric] || 0);
    });

    let result = `${this.getMetricDisplayName(relevantMetric)}の比較:\n\n`;

    Object.entries(aggregated)
      .sort(([,a], [,b]) => b - a)
      .forEach(([dimension, value]) => {
        const formattedValue = this.formatNumber(value, relevantMetric);
        result += `${dimension}: ${formattedValue}\n`;
      });

    return result;
  }

  private processTrend(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);

    const metrics = keys.filter(key => typeof firstItem[key] === 'number');

    if (metrics.length === 0) {
      return 'トレンド分析に必要なデータが不足しています。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);

    // 日付でソート（dateフィールドがある場合）
    let sortedData = data;
    if (firstItem.date) {
      sortedData = data.sort((a, b) => {
        const dateA = this.parseGA4Date(a.date);
        const dateB = this.parseGA4Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
    }

    const values = sortedData.map(item => item[relevantMetric] || 0);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;

    // 最初と最後の値で変化率を計算
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changeRate = firstValue !== 0 ? ((lastValue - firstValue) / firstValue * 100) : 0;

    let result = `${this.getMetricDisplayName(relevantMetric)}の推移:\n\n`;
    result += `合計: ${this.formatNumber(total, relevantMetric)}\n`;
    result += `平均: ${this.formatNumber(average, relevantMetric)}\n`;
    result += `変化率: ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}%\n`;

    return result;
  }

  private processDeviceBreakdown(data: any[], question: string): string {
    const deviceData = data.filter(item => item.deviceCategory);

    if (deviceData.length === 0) {
      return 'デバイス別データが見つかりませんでした。';
    }

    const firstItem = deviceData[0];
    const metrics = Object.keys(firstItem).filter(key => typeof firstItem[key] === 'number');

    if (metrics.length === 0) {
      return 'デバイス別分析に必要なメトリクスが見つかりませんでした。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);

    // デバイス別に集計
    const deviceTotals: Record<string, number> = {};
    deviceData.forEach(item => {
      const device = item.deviceCategory || 'その他';
      deviceTotals[device] = (deviceTotals[device] || 0) + (item[relevantMetric] || 0);
    });

    let result = `デバイス別${this.getMetricDisplayName(relevantMetric)}:\n\n`;

    Object.entries(deviceTotals)
      .sort(([,a], [,b]) => b - a)
      .forEach(([device, value]) => {
        const formattedValue = this.formatNumber(value, relevantMetric);
        result += `${device}: ${formattedValue}\n`;
      });

    return result;
  }

  private selectRelevantMetric(question: string, availableMetrics: string[]): string {
    const lowerQuestion = question.toLowerCase();

    // 質問内容からメトリクスを推測
    if ((lowerQuestion.includes('売上') || lowerQuestion.includes('revenue')) && availableMetrics.includes('totalRevenue')) {
      return 'totalRevenue';
    }
    if ((lowerQuestion.includes('pv') || lowerQuestion.includes('ページビュー')) && availableMetrics.includes('screenPageViews')) {
      return 'screenPageViews';
    }
    if ((lowerQuestion.includes('ユーザー') || lowerQuestion.includes('user')) && availableMetrics.includes('activeUsers')) {
      return 'activeUsers';
    }
    if ((lowerQuestion.includes('セッション') || lowerQuestion.includes('session')) && availableMetrics.includes('sessions')) {
      return 'sessions';
    }
    if ((lowerQuestion.includes('トランザクション') || lowerQuestion.includes('購入')) && availableMetrics.includes('transactions')) {
      return 'transactions';
    }

    // デフォルトは最初のメトリクス
    return availableMetrics[0];
  }

  private getMetricDisplayName(metric: string): string {
    const displayNames: Record<string, string> = {
      'totalRevenue': '売上',
      'screenPageViews': 'ページビュー',
      'activeUsers': 'アクティブユーザー',
      'sessions': 'セッション',
      'transactions': 'トランザクション',
      'bounceRate': '直帰率',
      'sessionDuration': 'セッション継続時間',
    };

    return displayNames[metric] || metric;
  }

  private formatNumber(value: number, metric: string): string {
    if (metric === 'totalRevenue') {
      return `¥${Math.round(value).toLocaleString()}`;
    }
    if (metric === 'bounceRate') {
      return `${(value * 100).toFixed(1)}%`;
    }
    return Math.round(value).toLocaleString();
  }

  private parseGA4Date(dateStr: string): Date {
    // GA4の日付フォーマット "20250929" を処理
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return new Date(`${year}-${month}-${day}`);
    }
    return new Date(dateStr);
  }

  // 複合パターン実装

  // パターン1: デバイス別 + 割合
  private deviceBreakdownWithPercentage(data: any[], question: string): string {
    const firstItem = data[0];
    const metrics = Object.keys(firstItem).filter(key => typeof firstItem[key] === 'number');
    const relevantMetric = this.selectRelevantMetric(question, metrics);

    // デバイス別に集計
    const deviceTotals: Record<string, number> = {};
    data.forEach(item => {
      const device = item.deviceCategory || 'その他';
      deviceTotals[device] = (deviceTotals[device] || 0) + (item[relevantMetric] || 0);
    });

    // 全体合計を計算
    const total = Object.values(deviceTotals).reduce((sum, val) => sum + val, 0);

    let result = `デバイス別${this.getMetricDisplayName(relevantMetric)}:\n`;

    // デバイス別数値を表示
    Object.entries(deviceTotals)
      .sort(([,a], [,b]) => b - a)
      .forEach(([device, value]) => {
        const formattedValue = this.formatNumber(value, relevantMetric);
        result += `${device}: ${formattedValue}\n`;
      });

    result += '\n割合:\n';

    // 割合を計算・表示
    Object.entries(deviceTotals)
      .sort(([,a], [,b]) => b - a)
      .forEach(([device, value]) => {
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
        result += `${device}: ${percentage}%\n`;
      });

    return result;
  }

  // パターン2: ランキング + 成長率
  private rankingWithGrowth(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const metrics = keys.filter(key => typeof firstItem[key] === 'number');
    const dimensions = keys.filter(key => typeof firstItem[key] === 'string');

    if (metrics.length === 0 || dimensions.length === 0) {
      return 'ランキング分析に必要なデータが不足しています。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);
    const relevantDimension = dimensions[0];

    // メトリクス値でソート
    const sorted = data.sort((a, b) => (b[relevantMetric] || 0) - (a[relevantMetric] || 0));
    const top5 = sorted.slice(0, 5);

    let result = `${this.getMetricDisplayName(relevantMetric)}のランキング（上位5位）:\n\n`;

    top5.forEach((item, index) => {
      const dimensionValue = item[relevantDimension] || 'その他';
      const metricValue = this.formatNumber(item[relevantMetric] || 0, relevantMetric);

      // 簡単な成長率計算（前の順位との比較）
      let growthInfo = '';
      if (index < top5.length - 1) {
        const current = item[relevantMetric] || 0;
        const next = top5[index + 1][relevantMetric] || 0;
        if (next > 0) {
          const growth = ((current - next) / next * 100).toFixed(1);
          growthInfo = ` (+${growth}% vs ${index + 2}位)`;
        }
      }

      result += `${index + 1}位: ${dimensionValue} - ${metricValue}${growthInfo}\n`;
    });

    return result;
  }

  // パターン3: チャネル別 + コンバージョン率
  private channelWithConversion(data: any[], question: string): string {
    // セッション数とトランザクション数が必要
    const hasConversionData = data.some(item =>
      item.sessions !== undefined && item.transactions !== undefined
    );

    if (!hasConversionData) {
      return 'コンバージョン率の計算に必要なデータ（セッション数・トランザクション数）が不足しています。';
    }

    // チャネル別に集計
    const channelData: Record<string, { sessions: number; transactions: number; revenue: number }> = {};

    data.forEach(item => {
      const channel = item.sessionDefaultChannelGrouping || 'その他';
      if (!channelData[channel]) {
        channelData[channel] = { sessions: 0, transactions: 0, revenue: 0 };
      }
      channelData[channel].sessions += item.sessions || 0;
      channelData[channel].transactions += item.transactions || 0;
      channelData[channel].revenue += item.totalRevenue || 0;
    });

    let result = 'チャネル別分析:\n\n';

    Object.entries(channelData)
      .sort(([,a], [,b]) => b.sessions - a.sessions)
      .forEach(([channel, metrics]) => {
        const conversionRate = metrics.sessions > 0 ?
          (metrics.transactions / metrics.sessions * 100).toFixed(2) : '0.00';
        const avgOrderValue = metrics.transactions > 0 ?
          Math.round(metrics.revenue / metrics.transactions) : 0;

        result += `${channel}:\n`;
        result += `  セッション: ${metrics.sessions.toLocaleString()}\n`;
        result += `  トランザクション: ${metrics.transactions.toLocaleString()}\n`;
        result += `  コンバージョン率: ${conversionRate}%\n`;
        result += `  平均注文単価: ¥${avgOrderValue.toLocaleString()}\n\n`;
      });

    return result;
  }

  // パターン4: 比較 + 差分
  private comparisonWithDifference(data: any[], question: string): string {
    const firstItem = data[0];
    const keys = Object.keys(firstItem);
    const metrics = keys.filter(key => typeof firstItem[key] === 'number');
    const dimensions = keys.filter(key => typeof firstItem[key] === 'string');

    if (metrics.length === 0 || dimensions.length === 0) {
      return '比較分析に必要なデータが不足しています。';
    }

    const relevantMetric = this.selectRelevantMetric(question, metrics);
    const relevantDimension = dimensions[0];

    // ディメンション別に集計
    const aggregated: Record<string, number> = {};
    data.forEach(item => {
      const dimValue = item[relevantDimension] || 'その他';
      aggregated[dimValue] = (aggregated[dimValue] || 0) + (item[relevantMetric] || 0);
    });

    const sortedEntries = Object.entries(aggregated).sort(([,a], [,b]) => b - a);

    let result = `${this.getMetricDisplayName(relevantMetric)}の比較:\n\n`;

    sortedEntries.forEach(([dimension, value], index) => {
      const formattedValue = this.formatNumber(value, relevantMetric);
      result += `${dimension}: ${formattedValue}`;

      // 最上位との差分を計算
      if (index > 0) {
        const topValue = sortedEntries[0][1];
        const difference = topValue - value;
        const percentageDiff = topValue > 0 ? ((difference / topValue) * 100).toFixed(1) : '0.0';
        result += ` (1位との差: ${this.formatNumber(difference, relevantMetric)}, -${percentageDiff}%)`;
      }

      result += '\n';
    });

    return result;
  }

  // パターン5: トレンド + 予測（簡易版）
  private trendWithForecast(data: any[], question: string): string {
    const trendResult = this.processTrend(data, question);

    // 簡単な線形予測を追加
    const firstItem = data[0];
    const metrics = Object.keys(firstItem).filter(key => typeof firstItem[key] === 'number');
    const relevantMetric = this.selectRelevantMetric(question, metrics);

    if (data.length >= 3) {
      const recentValues = data.slice(-3).map(item => item[relevantMetric] || 0);
      const trend = (recentValues[2] - recentValues[0]) / 2;
      const nextPrediction = recentValues[2] + trend;

      const forecastResult = `\n予測（簡易線形）:\n次期予想値: ${this.formatNumber(nextPrediction, relevantMetric)}`;
      return trendResult + forecastResult;
    }

    return trendResult + '\n\n予測: データ不足のため予測できません（3日以上のデータが必要）';
  }

  // 期間比較処理（先月vs今月など）
  private processPeriodComparison(data: any, question: string): string {
    const period1Data = data.period1.data;
    const period2Data = data.period2.data;

    // メトリクスを取得
    const firstItem = period1Data[0];
    const metrics = Object.keys(firstItem).filter(key => typeof firstItem[key] === 'number');
    const relevantMetric = this.selectRelevantMetric(question, metrics);

    // 各期間の合計値を計算
    const period1Value = period1Data.reduce((sum: number, item: any) => sum + (item[relevantMetric] || 0), 0);
    const period2Value = period2Data.reduce((sum: number, item: any) => sum + (item[relevantMetric] || 0), 0);

    // 変化率を計算
    const change = period2Value - period1Value;
    const changeRate = period1Value > 0 ? ((change / period1Value) * 100).toFixed(1) : '0.0';
    const changeSymbol = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';

    const metricDisplayName = this.getMetricDisplayName(relevantMetric);

    return `${data.period1.label}の${metricDisplayName}: ${this.formatNumber(period1Value, relevantMetric)}
${data.period2.label}の${metricDisplayName}: ${this.formatNumber(period2Value, relevantMetric)}

${changeSymbol} 変化: ${this.formatNumber(Math.abs(change), relevantMetric)} (${changeRate > '0' ? '+' : ''}${changeRate}%)`;
  }
}