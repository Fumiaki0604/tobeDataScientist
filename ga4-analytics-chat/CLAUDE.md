# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

このリポジトリは、Google Analytics 4 (GA4) のデータ分析を自然言語で行うための2つのコンポーネントで構成されています：

1. **MCP Server** (`mcp-server/`): Model Context Protocol サーバー - LLMがGA4 APIと対話するためのツールを提供
2. **Next.js Web App** (`nextjs-project/`): GA4分析のためのWebインターフェース（OAuth認証、チャット機能）

## 開発コマンド

### MCP Server
```bash
cd mcp-server
npm run build      # TypeScriptをビルド (dist/にコンパイル)
npm run dev        # 開発モード（tsx使用、ホットリロード）
npm start          # 本番モード (dist/index.js実行)
```

### Next.js Web App
```bash
cd nextjs-project
npm run dev        # 開発サーバー起動 (http://localhost:3000、Turbopack使用)
npm run build      # 本番ビルド (Turbopack使用)
npm start          # 本番サーバー起動
npm run lint       # ESLint実行
```

### 環境変数設定
Next.jsアプリケーションには`.env.local`が必要です（`.env.example`を参照）：
- `NEXTAUTH_URL`: アプリケーションのベースURL
- `NEXTAUTH_SECRET`: NextAuth用のシークレットキー
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth認証情報
- `OPENAI_API_KEY`: OpenAI APIキー（チャット機能用）

## アーキテクチャ

### MCP Server (`mcp-server/src/`)

**設計思想**: シンプル化を重視。LLMが直接パラメータを推論してGA4データを取得。中間的なクエリ解析やデータ処理ツールは削除済み。

**主要ファイル**:
- `index.ts`: MCPサーバーのエントリポイント
  - 提供ツール: `fetch_ga4_data`のみ（GA4 Data APIからデータ取得）
  - ツール説明に利用可能なメトリクス/ディメンションと使用例を含む（LLMが適切なパラメータを選択できるように）

- `ga4-client.ts`: Google Analytics Data API v1との通信
  - `runReport` APIを使用してデータ取得
  - メトリクス: `totalRevenue`, `screenPageViews`, `activeUsers`, `sessions`, `transactions`, `itemRevenue`, etc.
  - ディメンション: `date`, `deviceCategory`, `itemName`, `pagePath`, `sessionSource`, etc.

- `query-analyzer.ts`: **現在は未使用** (レガシーコード)
  - 元々は質問のパターンマッチングに使用していたが、LLM直接推論に移行したため不要に

- `data-processor.ts`: **現在は未使用** (レガシーコード)
  - 元々はデータ整形・集計に使用していたが、LLMが直接解釈するため不要に

### Next.js Web App (`nextjs-project/src/`)

**アーキテクチャパターン**: Next.js 15 App Router + NextAuth認証 + API Routes + OpenAI Function Calling

**ディレクトリ構成**:
- `app/`: App Router構造
  - `page.tsx`: メインダッシュボード（日別・チャネル別・商品別データ表示 + チャットUI）
  - `layout.tsx`: ルートレイアウト（SessionProvider配置）
  - `api/`: APIエンドポイント
    - `auth/[...nextauth]/route.ts`: Google OAuth認証（トークン自動リフレッシュ実装）
    - `chat/route.ts`: **重要** AIチャットAPI（OpenAI Function Calling、複数Function Calls対応）
    - `analytics/route.ts`: GA4データ取得API
    - `properties/route.ts`: ユーザーのGA4プロパティ一覧取得
    - `property/route.ts`: 特定プロパティのメタデータ取得

- `components/`: React コンポーネント
  - `ChatInterface.tsx`: AIチャットUI（質問例、分析状態表示）
  - `PropertySelector.tsx`: GA4プロパティ選択UI
  - `GA4LoadingSpinner.tsx`: プロパティ読み込み中のローディング画面

- `mcp-modules/`: GA4 Data API クライアント
  - `ga4-client.ts`: GA4 Data API v1beta との通信（メトリクス・ディメンション取得、データ整形）

- `types/`: TypeScript型定義
  - `next-auth.d.ts`: NextAuth型拡張（accessTokenをセッションに追加）

**認証フロー**:
1. NextAuthでGoogle OAuthログイン（`analytics.readonly` + `analytics.manage.users.readonly` スコープ）
2. アクセストークン + リフレッシュトークンをセッションに保存
3. トークン期限切れ時に自動リフレッシュ（`refreshAccessToken`関数）
4. GA4 API呼び出し時に有効なアクセストークンを使用

**データフロー（ダッシュボード）**:
1. ユーザーがGA4プロパティを選択
2. 日付範囲とデバイスフィルターを選択（カスタム期間も可能）
3. `fetchAnalyticsData`が3つのGA4 APIリクエストを並列実行:
   - 日別データ（sessions, screenPageViews, transactions, totalRevenue）
   - チャネル別データ（sessionDefaultChannelGrouping別のsessions）
   - 商品別売上TOP10（itemName別のitemRevenue）
4. Rechartsでグラフ表示

**データフロー（AIチャット）**:
1. ユーザーが自然言語で質問を入力
2. `/api/chat`がOpenAI GPT-4oにFunction Calling tools付きでリクエスト
3. **複数Function Calls対応**: `tool_calls`配列を全てループ処理（lines 134-159）
4. 各`fetch_ga4_data`を実行してGA4データを取得
5. すべての結果をOpenAIに返して最終回答を生成
6. 回答をチャットUIに表示

**複数Function Callsの例**:
- 「前年同月と直近一ヶ月から今月のユーザー数を予測してください」→ 2回のGA4データ取得
- 「先月と今月でデバイス別の訪問者数を比較してください」→ 2回のGA4データ取得

## 重要な技術的決定

### 複数Function Calls対応（`/api/chat/route.ts`）
**背景**: 「前年同月と今月を比較」など複数期間のデータが必要な質問に対応するため

**実装のポイント**:
- `tool_calls`配列を**必ずループ処理**する（lines 134-159）
- 各Function Callの結果を`messages`配列に追加（`role: 'tool'`）
- すべてのFunction Call完了後に最終回答を生成

**注意**: 単一Function Call前提の実装（`tool_calls[0]`のみ処理）だとエラーになります

### ダッシュボードのフィルタリング機能（`app/page.tsx`）
**日付範囲フィルター**:
- プリセット: 7/30/90/180/365日前
- カスタム: 開始日・終了日を個別に選択可能
- 実装: `dateRange === 'custom'`の場合に`customStartDate`/`customEndDate`を使用

**デバイスフィルター**:
- オプション: すべて/Desktop/モバイル
- 実装: `deviceFilter !== 'all'`の場合、GA4 APIに`deviceCategory`ディメンションを追加し、取得後にフィルタリング

### アクセストークンの自動リフレッシュ
- Google OAuthで`access_type: 'offline'` + `prompt: 'consent'`を設定
- リフレッシュトークンを保存してトークン期限切れ時に自動更新
- 実装: `auth/[...nextauth]/route.ts`の`refreshAccessToken`関数

### なぜMCPサーバーをシンプル化したか
- **以前**: 3ツール構成（`analyze_ga4_query` → `fetch_ga4_data` → `process_ga4_data`）
- **現在**: 1ツール構成（`fetch_ga4_data`のみ）
- **理由**: LLM自身が質問を理解してパラメータを推論できるため、パターンマッチングやデータ整形は不要
- **効果**: トークン消費量が約50%削減、保守コストも削減

## GA4 API制限と注意点
- Data API v1は1プロパティあたり1日25,000リクエストまで
- ディメンション最大9個、メトリクス最大10個まで同時取得可能
- `date`ディメンション使用時、日付は`YYYYMMDD`形式で返されます
- デバイスカテゴリの値: `desktop`, `mobile`, `tablet`（小文字）

## デプロイ
- **プラットフォーム**: Render
- **自動デプロイ**: masterブランチへのpush時
- **ビルドコマンド**: `npm run build` (Turbopack使用)
