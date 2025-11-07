/**
 * 異常検知ユーティリティ
 * ルールベースで多次元クロス分析を行い、異常を検知する
 */

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface DimensionData {
  dimension: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
}

export interface Anomaly {
  metric: string;
  severity: 'critical' | 'warning' | 'positive';
  changePercent: number;
  currentValue: number;
  previousValue: number;
  dimensions?: DimensionData[];
  detectedAt: string;
}

/**
 * 2つの期間のデータを比較して異常を検知
 * @param current 現在期間の値
 * @param previous 前期間の値
 * @param threshold 異常判定の閾値（デフォルト20%）
 */
export function detectAnomaly(
  current: number,
  previous: number,
  threshold: number = 20
): { isAnomaly: boolean; changePercent: number; severity: 'critical' | 'warning' | 'positive' } {
  if (previous === 0) {
    return { isAnomaly: false, changePercent: 0, severity: 'warning' };
  }

  const changePercent = ((current - previous) / previous) * 100;
  const absChange = Math.abs(changePercent);

  let severity: 'critical' | 'warning' | 'positive' = 'warning';

  if (changePercent < -threshold) {
    // ネガティブな変化
    severity = absChange >= 40 ? 'critical' : 'warning';
  } else if (changePercent > threshold) {
    // ポジティブな変化
    severity = 'positive';
  }

  return {
    isAnomaly: absChange >= threshold,
    changePercent: Math.round(changePercent * 10) / 10,
    severity
  };
}

/**
 * ディメンション別データから異常を検出
 */
export function findAnomalousDimensions(
  dimensionData: DimensionData[],
  threshold: number = 20
): DimensionData[] {
  return dimensionData
    .map(data => ({
      ...data,
      anomaly: detectAnomaly(data.currentValue, data.previousValue, threshold)
    }))
    .filter(data => data.anomaly.isAnomaly)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * メトリクス全体の異常をスコアリング
 */
export function calculateAnomalyScore(
  changePercent: number,
  currentValue: number,
  previousValue: number
): number {
  const absChange = Math.abs(changePercent);
  const valueWeight = Math.log10(Math.max(currentValue, previousValue) + 1);

  // 変化率と値の大きさを考慮したスコア
  return absChange * valueWeight;
}

/**
 * 複数メトリクスから最も重要な異常を抽出
 */
export function rankAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return anomalies
    .map(anomaly => ({
      ...anomaly,
      score: calculateAnomalyScore(
        anomaly.changePercent,
        anomaly.currentValue,
        anomaly.previousValue
      )
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 時系列データから突然の変化を検出
 */
export function detectSuddenChange(data: TimeSeriesData[]): {
  hasChange: boolean;
  changeDate?: string;
  changeType?: 'spike' | 'drop';
} {
  if (data.length < 7) {
    return { hasChange: false };
  }

  // 3日間の移動平均を計算
  const movingAvg = (idx: number) => {
    const start = Math.max(0, idx - 2);
    const end = Math.min(data.length, idx + 1);
    const slice = data.slice(start, end);
    return slice.reduce((sum, d) => sum + d.value, 0) / slice.length;
  };

  // 前後の移動平均を比較して急激な変化を検出
  for (let i = 3; i < data.length - 3; i++) {
    const beforeAvg = movingAvg(i - 3);
    const afterAvg = movingAvg(i + 3);
    const changePercent = ((afterAvg - beforeAvg) / beforeAvg) * 100;

    if (Math.abs(changePercent) > 30) {
      return {
        hasChange: true,
        changeDate: data[i].date,
        changeType: changePercent > 0 ? 'spike' : 'drop'
      };
    }
  }

  return { hasChange: false };
}
