# GA4 Analytics Chat - デプロイ手順

## 概要

このプロジェクトは3つのコンポーネントで構成されています：

1. **Next.js Web App** (`nextjs-project/`) - フロントエンド
2. **MCP Server** (`mcp-server/`) - GA4データ取得
3. **Forecast API** (`forecast-api/`) - Prophet予測サーバー ✨NEW

## 予測機能のデプロイ手順

### 1. Python予測サーバー（Forecast API）のデプロイ

#### Renderでの設定

1. Render Dashboardで「New Web Service」を作成
2. GitHubリポジトリを選択: `ga4-analytics-chat`
3. 以下の設定:
   - **Name**: `ga4-forecast-api` (任意)
   - **Root Directory**: `forecast-api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

4. デプロイ完了後、URLをメモ（例: `https://ga4-forecast-api.onrender.com`）

### 2. Next.jsアプリの環境変数更新

#### Renderの環境変数に追加

Next.jsアプリのRender設定で、以下の環境変数を追加:

```
FORECAST_API_URL=https://ga4-forecast-api.onrender.com
```

（先ほどメモしたPythonサーバーのURL）

### 3. Next.jsアプリの再デプロイ

Renderが自動的に再デプロイします。

## ローカルでのテスト

### 1. Pythonサーバーの起動

```bash
cd forecast-api
pip install -r requirements.txt
python main.py
```

→ http://localhost:8000 で起動

### 2. Next.jsアプリの環境変数設定

`.env.local`に追加:
```
FORECAST_API_URL=http://localhost:8000
```

### 3. Next.jsアプリの起動

```bash
cd nextjs-project
npm run dev
```

→ http://localhost:3000 で起動

### 4. 予測機能のテスト

1. GA4プロパティを選択
2. ダッシュボードタブでデータを取得（最低7日分）
3. 「売上予測」タブをクリック
4. 予測期間を設定して「予測を実行」

## 機能説明

### 売上予測タブ

- **使用技術**: Meta社のProphetライブラリ
- **予測対象**: 売上（totalRevenue）
- **必要データ**: 最低7日分の過去データ
- **予測期間**: 7〜90日（デフォルト30日）
- **出力**:
  - 予測値（点線グラフ）
  - 95%信頼区間（薄青の範囲）
  - 予測期間の売上合計
  - 1日あたり平均売上

### API仕様

#### POST /api/forecast

**リクエスト:**
```json
{
  "data": [
    {"date": "2024-01-01", "value": 100000},
    {"date": "2024-01-02", "value": 120000}
  ],
  "periods": 30,
  "metric_name": "売上（円）"
}
```

**レスポンス:**
```json
{
  "historical": [...],
  "forecast": [...],
  "metric_name": "売上（円）"
}
```

## トラブルシューティング

### 予測サーバーが起動しない

- Renderのログを確認
- Pythonバージョンが3.11以上か確認
- `requirements.txt`の依存関係を確認

### 予測が遅い

- 無料プランはスリープモードあり（初回起動に10-30秒）
- 有料プラン（$7/月〜）で常時起動可能

### CORSエラー

- `FORECAST_API_URL`が正しく設定されているか確認
- Pythonサーバーの`main.py`でCORS設定を確認

## 今後の拡張案

- [ ] 複数メトリクスの予測対応（セッション数、コンバージョン数など）
- [ ] 予測モデルのパラメータ調整UI
- [ ] 予測精度の表示（MAPE、RMSEなど）
- [ ] 予測結果のCSVエクスポート
- [ ] 過去の予測履歴の保存
