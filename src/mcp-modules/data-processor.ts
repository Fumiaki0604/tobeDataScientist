export class DataProcessor {
  async processData(data: any[], question: string, analysisType: string): Promise<string> {
    console.log(`[DataProcessor] Processing ${analysisType} analysis for: "${question}"`);
    console.log(`[DataProcessor] Data points: ${data.length}`);

    if (!data || data.length === 0) {
      return 'データが見つかりませんでした。';
    }

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
}