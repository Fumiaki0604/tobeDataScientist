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

**アーキテクチャパターン**: Next.js 15 App Router + NextAuth認証 + API Routes

**ディレクトリ構成**:
- `app/`: App Router構造
  - `page.tsx`: メインページ（GA4プロパティ選択 + チャットインターフェース）
  - `layout.tsx`: ルートレイアウト（SessionProvider配置）
  - `api/`: APIエンドポイント
    - `auth/[...nextauth]/route.ts`: Google OAuth認証
    - `chat/route.ts`: チャットAPI（OpenAI統合、GA4データ取得）
    - `analytics/route.ts`: GA4データ取得API
    - `properties/route.ts`: ユーザーのGA4プロパティ一覧取得
    - `property/route.ts`: 特定プロパティのメタデータ取得

- `components/`: React コンポーネント
  - `ChatInterface.tsx`: チャットUI
  - `PropertySelector.tsx`: GA4プロパティ選択UI

- `mcp-modules/`: **注意**: Next.js内のレガシーコード
  - MCPサーバーと同じロジックのコピー（`query-analyzer.ts`, `data-processor.ts`, `ga4-client.ts`）
  - 現在は`/api/chat/route.ts`で使用されているが、MCPサーバーへの統合が推奨される

- `types/`: TypeScript型定義
  - `next-auth.d.ts`: NextAuth型拡張（accessTokenをセッションに追加）

**認証フロー**:
1. NextAuthでGoogle OAuthログイン
2. アクセストークンをセッションに保存（`callbacks.jwt`と`callbacks.session`）
3. GA4 API呼び出し時にアクセストークンを使用

**データフロー**:
1. ユーザーがGA4プロパティを選択
2. チャット入力で質問を送信
3. `/api/chat`がOpenAIとGA4 APIを組み合わせて回答生成
4. 結果をチャットインターフェースに表示

## 重要な技術的決定

### なぜMCPサーバーをシンプル化したか
- **以前**: 3ツール構成（`analyze_ga4_query` → `fetch_ga4_data` → `process_ga4_data`）
- **現在**: 1ツール構成（`fetch_ga4_data`のみ）
- **理由**: LLM自身が質問を理解してパラメータを推論できるため、パターンマッチングやデータ整形は不要
- **効果**: トークン消費量が約50%削減、保守コストも削減

### Next.js内のmcp-modulesについて
- `nextjs-project/src/mcp-modules/`は`mcp-server/src/`のロジックの重複
- 理想的には`/api/chat`がMCPサーバーを呼び出すべき
- 現状は独立して動作（将来的な統合を検討）

## GA4 API制限
- Data API v1は1プロパティあたり1日25,000リクエストまで
- ディメンション最大9個、メトリクス最大10個まで同時取得可能
