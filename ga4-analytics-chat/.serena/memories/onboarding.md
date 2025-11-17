# GA4 Analytics Chat - オンボーディングガイド

## プロジェクト概要

Google Analytics 4 (GA4) のデータを自然言語で分析できるWebアプリケーション。

### 主な機能
1. **AIチャット分析**: 自然言語でGA4データを質問・分析
2. **ダッシュボード**: 日別・チャネル別・商品別のビジュアル分析
3. **売上予測**: Prophetを使った時系列予測（Prophet機械学習モデル）

## アーキテクチャ

```
プロジェクト構成:
├── nextjs-project/      # Next.js 15 Webアプリ（フロントエンド + API）
├── forecast-api/        # Python FastAPI（Prophet予測サーバー）
└── mcp-server/          # MCP Server（LLM用GA4 APIツール、現在は未使用）
```

### 技術スタック

**フロントエンド（Next.js）:**
- Next.js 15 App Router
- NextAuth (Google OAuth認証)
- TypeScript
- Tailwind CSS
- Recharts（グラフ描画）

**バックエンド（API Routes）:**
- `/api/auth/[...nextauth]`: Google OAuth認証
- `/api/chat`: OpenAI GPT-4o Function Calling
- `/api/analytics`: GA4 Data API プロキシ
- `/api/properties`: GA4プロパティ一覧取得
- `/api/properties-stream`: SSEでプロパティ取得進捗配信
- `/api/forecast`: Python予測APIプロキシ

**予測API（Python）:**
- FastAPI
- Prophet（Meta社の時系列予測ライブラリ）
- pandas

## 開発環境セットアップ

### 1. Next.js アプリケーション

```bash
cd nextjs-project
npm install
```

**環境変数（.env.local）:**
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<ランダム文字列>
GOOGLE_CLIENT_ID=<Google OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth Client Secret>
OPENAI_API_KEY=<OpenAI APIキー>
FORECAST_API_URL=http://localhost:8000
```

**起動:**
```bash
npm run dev  # http://localhost:3000
```

### 2. Python 予測API

```bash
cd forecast-api
pip install -r requirements.txt
python main.py  # http://localhost:8000
```

## デプロイ（Render）

### Next.js Web App
- Repository: `https://github.com/Fumiaki0604/GA4AnalyticsDashboard`
- Root Directory: `ga4-analytics-chat/nextjs-project`
- Build Command: `npm run build`
- Start Command: `npm start`

### Forecast API
- Repository: 同上
- Root Directory: `ga4-analytics-chat/forecast-api`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check: `/health`

## 主要機能の実装詳細

### 1. Google OAuth認証

**フロー:**
1. NextAuthでGoogle OAuthログイン
2. `analytics.readonly` + `analytics.manage.users.readonly` スコープ取得
3. アクセストークン + リフレッシュトークンをセッションに保存
4. トークン期限切れ時に自動リフレッシュ

**実装:** `src/app/api/auth/[...nextauth]/route.ts`

### 2. AIチャット分析

**技術:** OpenAI GPT-4o Function Calling

**フロー:**
1. ユーザーが自然言語で質問（例: 「先月の売上は？」）
2. OpenAIが適切なGA4 APIパラメータを推論
3. `fetch_ga4_data` Functionを実行してデータ取得
4. OpenAIが結果を自然言語で解説

**複数Function Calls対応:**
- 「前年同月と今月を比較」など複数期間のデータ取得に対応
- `tool_calls`配列を全てループ処理

**実装:** `src/app/api/chat/route.ts`

### 3. ダッシュボード

**表示内容:**
- 日別グラフ（sessions, pageViews, transactions, revenue）
- チャネル別セッション数
- 商品別売上TOP10
- デバイスフィルター（全て/Desktop/モバイル）
- 日付範囲フィルター（7/30/90/180/365日、カスタム期間）

**データ取得:** GA4 Data API v1beta

**実装:** `src/app/page.tsx`, `src/mcp-modules/ga4-client.ts`

### 4. 売上予測（Prophet）

**学習期間:** 365日（1年、推奨）または730日（2年）

**予測期間:** 今月末まで / 来月末まで

**Prophet設定:**
- 週次季節性: 有効（週末効果）
- 年次季節性: データ期間180日以上で自動有効化
- 予測値の下限: 平均値の5%（¥0防止）
- 当日のデータは学習から除外

**表示内容:**
- 予測グラフ（実績・予測・信頼区間）
- 月別売上予測テーブル
- 予測期間の売上合計・1日平均

**実装:**
- フロント: `src/components/ForecastTab.tsx`
- バックエンド: `forecast-api/main.py`

### 5. プロパティ選択（SSEログ表示）

**技術:** Server-Sent Events (SSE)

**フロー:**
1. ユーザーがログイン
2. プロパティ一覧取得開始
3. リアルタイムでログをストリーミング配信
   - 「アカウント名: X件のプロパティ取得」
   - 最新3行のみ表示
4. 完了後、プロパティ選択画面を表示

**実装:**
- SSE API: `src/app/api/properties-stream/route.ts`
- ローディング画面: `src/components/GA4LoadingSpinner.tsx`

## トラブルシューティング

### 予測APIが起動しない（502 Bad Gateway）

**原因:** Render無料プランで15分間アクセスがないとスリープ

**解決策:**
1. ヘッダーの「起動」ボタンをクリック
2. 最大120秒待機してサーバー起動
3. 起動完了後、予測タブが使用可能に

### プロパティが取得できない

**原因:** Google Analytics Admin APIが有効化されていない

**解決策:**
1. Google Cloud Consoleにアクセス
2. Analytics Admin APIを有効化
3. OAuth同意画面でスコープを設定

### トークンの期限切れ

**自動処理:** `refreshAccessToken`関数が自動的にリフレッシュ

**手動対応:** ログアウト→再ログイン

## コミット規約

```
Fix: バグ修正
Feat: 新機能追加
Update: 既存機能の改善
Refactor: コードの整理

例:
Fix: Prophet予測の¥0問題を修正
Feat: プロパティ選択画面のUX改善
```

**コミットメッセージ末尾:**
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 重要なファイル

### フロントエンド
- `src/app/page.tsx`: メインダッシュボード
- `src/app/api/chat/route.ts`: AIチャットAPI（Function Calling）
- `src/components/ForecastTab.tsx`: 売上予測タブ
- `src/components/PropertySelector.tsx`: プロパティ選択UI
- `src/components/GA4LoadingSpinner.tsx`: ローディング画面（SSEログ表示）
- `src/mcp-modules/ga4-client.ts`: GA4 Data API クライアント

### バックエンド（Python）
- `forecast-api/main.py`: Prophet予測API

### 設定ファイル
- `CLAUDE.md`: グローバル設定（日本語指示）
- `ga4-analytics-chat/CLAUDE.md`: プロジェクト固有の指示書

## よくある作業

### 新しいGA4メトリクスを追加

1. `src/mcp-modules/ga4-client.ts`に型定義追加
2. APIリクエストにメトリクス追加
3. フロント側で表示処理追加

### OpenAI Function Calling の関数を追加

1. `src/app/api/chat/route.ts`の`tools`配列に追加
2. `tool_calls`ループ内で処理追加

### Prophetの予測パラメータ調整

`forecast-api/main.py`の`Prophet()`パラメータを変更:
- `changepoint_prior_scale`: トレンドの柔軟性
- `seasonality_prior_scale`: 季節性の強度
- `weekly_seasonality` / `yearly_seasonality`: 季節性のON/OFF

## 参考リンク

- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [NextAuth.js](https://next-auth.js.org/)
- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Prophet Documentation](https://facebook.github.io/prophet/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

## 現在の状態（2025-10-22時点）

✅ 実装済み機能:
- Google OAuth認証（自動トークンリフレッシュ）
- AIチャット分析（複数Function Calls対応）
- ダッシュボード（日別・チャネル別・商品別）
- 売上予測（Prophet、当日除外、¥0防止）
- プロパティ選択（SSEログ表示、ログアウトボタン）
- 予測APIサーバー起動ボタン

🔄 改善中:
- SSEログ表示の動作確認（デプロイ後テスト予定）

📝 今後の改善案:
- キャッシュ戦略の最適化
- エラーハンドリングの強化
- パフォーマンス監視
