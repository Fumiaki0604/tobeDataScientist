# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語設定

**すべての回答は日本語で行ってください。**

## プロジェクト概要

データサイエンティスト検定リテラシーレベルの試験対策用Webアプリケーション。
AIが問題を生成し、ユーザーが回答、正答率と合格可能性を判定する。

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動 (http://localhost:3000)
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm start

# リンター実行
npm run lint
```

## 技術スタック

- **Next.js 14** (App Router) - サーバーコンポーネントとクライアントコンポーネントの使い分けに注意
- **Supabase** - PostgreSQL + 認証 + ストレージ
- **TypeScript** - 型定義は `types/database.ts`, `types/slack.ts` を参照
- **Tailwind CSS** - スタイリング
- **OpenAI API** - AI問題生成 (gpt-4など)
- **pdf-parse** - PDFファイルからのテキスト抽出
- **Recharts** - データ可視化・グラフ表示
- **@slack/web-api** - Slack連携・日次配信機能

## アーキテクチャ

### Supabase クライアントの使い分け

**重要**: 実行環境に応じて適切なクライアントを使用する必要がある

- **クライアントコンポーネント**: `lib/supabase/client.ts` の `createClient()`
  - ブラウザで実行されるコンポーネント
  - `'use client'` ディレクティブが必要

- **サーバーコンポーネント**: `lib/supabase/server.ts` の `createClient()`
  - サーバーで実行されるコンポーネント（デフォルト）
  - cookieを使用した認証状態の管理
  - **必ず `await createClient()` で呼び出す**（非同期関数）

- **ミドルウェア**: `lib/supabase/middleware.ts` の `updateSession()`
  - `middleware.ts` から呼び出される
  - 認証状態の確認とリダイレクト処理

### 認証フロー

1. ユーザーがログイン/登録
2. Supabase Authがセッション作成
3. ミドルウェアが全リクエストで認証状態を確認
4. 未認証の場合は `/auth/login` にリダイレクト
5. 管理者ルート (`/admin`) は `role='admin'` のチェックあり

### データベースアクセスパターン

**Row Level Security (RLS) が有効**なため、ポリシーを理解する必要がある:

- 一般ユーザー: 自分のデータのみアクセス可能
- 管理者: 全データにアクセス可能
- 問題: `is_approved=true` のみ一般ユーザーに表示

RLSポリシーの詳細は `supabase/rls-policies.sql` を参照。

### データベーススキーマの重要ポイント

**主要テーブル**:

**コア機能テーブル** (8つ):
1. `user_profiles` - ユーザー情報拡張 (role管理)
2. `categories` - 階層構造のカテゴリ (parent_id)
3. `questions` - 4択問題 (is_approved フラグ重要)
4. `exam_sessions` - 試験セッション
5. `exam_answers` - 個別回答記録
6. `exam_settings` - グローバル設定
7. `pdf_sources` - PDFファイル管理
8. `ai_generation_logs` - AI生成履歴

**Slack連携テーブル** (7つ):
1. `slack_integrations` - Slack OAuth情報とワークスペース連携
2. `slack_daily_delivery_settings` - 配信設定（時刻、チャンネル、出題設定）
3. `slack_daily_deliveries` - 配信実績ログ（問題、ステータス、統計）
4. `slack_answers` - Slackからの回答記録（連続記録計算用）
5. `slack_gamification_streaks` - 連続正答日数管理
6. `slack_achievements` - アチーブメント・バッジ
7. `slack_user_mappings` - SlackユーザーとSupabaseユーザーの紐付け

詳細は `supabase/schema.sql` と `supabase/migrations/20260101000000_slack_integration.sql` を参照。

## 開発時の注意点

### 環境変数

`.env.local` ファイルが必要（`.env.example` をコピー）:

**必須の環境変数**:
- `NEXT_PUBLIC_SUPABASE_URL` - SupabaseプロジェクトURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase匿名キー
- `OPENAI_API_KEY` - OpenAI APIキー（AI問題生成用）
- `NEXT_PUBLIC_APP_URL` - アプリケーションURL（本番: Vercel URL、ローカル: http://localhost:3000）

**Slack連携の環境変数**（Phase 7実装時に必要）:
- `SLACK_CLIENT_ID` - Slack AppのClient ID
- `SLACK_CLIENT_SECRET` - Slack AppのClient Secret
- `SLACK_SIGNING_SECRET` - Slack AppのSigning Secret（署名検証用）
- `SLACK_TOKEN_ENCRYPTION_KEY` - トークン暗号化鍵（64文字のhex、`openssl rand -hex 32` で生成）
- `CRON_SECRET` - Vercel Cron認証用シークレット（`openssl rand -hex 32` で生成）

**重要**: Slack関連の環境変数は、Slack App作成後に設定する。

### Server Actions

Server Actionsを使用する場合は `'use server'` ディレクティブが必要。
例: ログアウト処理は [app/dashboard/page.tsx:23-28](tobeDataScientist/app/dashboard/page.tsx#L23-L28) を参照。

### ディレクトリ構造

```
app/
├── api/                      # API Routes
│   ├── generate-questions/   # AI問題生成エンドポイント
│   ├── export/              # データエクスポートAPI
│   │   ├── questions/       # 問題データエクスポート
│   │   ├── sessions/        # 試験結果エクスポート
│   │   └── users/           # ユーザーデータエクスポート
│   ├── slack/               # Slack連携API（Phase 7）
│   │   ├── oauth/callback/  # Slack OAuth認証コールバック
│   │   ├── interactions/    # インタラクティブボタン処理（Phase 7）
│   │   └── events/          # Slackイベント受信（Phase 7、オプション）
│   └── cron/                # Vercel Cron Jobs（Phase 7）
│       └── send-daily-questions/  # 日次配信
├── auth/                     # 認証関連
│   ├── login/               # ログイン
│   ├── signup/              # 新規登録
│   ├── reset-password/      # パスワードリセット
│   └── update-password/     # パスワード更新
├── dashboard/               # ダッシュボード
│   ├── history/            # 学習履歴
│   │   └── [id]/          # 学習履歴詳細
│   └── change-password/   # パスワード変更
├── exam/                    # 試験機能
│   ├── start/              # 試験設定・開始
│   └── [sessionId]/        # 試験実施・結果
└── admin/                   # 管理者機能
    ├── questions/          # 問題管理
    ├── categories/         # カテゴリ管理
    ├── users/              # ユーザー管理
    ├── settings/           # 試験設定
    ├── analytics/          # 分析・レポート
    ├── export/             # データエクスポート
    ├── pdfs/               # PDF管理
    └── slack/              # Slack連携管理（Phase 7）
        ├── settings/       # 配信設定（Phase 7）
        └── history/        # 配信履歴（Phase 7）

lib/
├── supabase/               # Supabaseクライアント設定
└── slack/                  # Slack連携ライブラリ（Phase 7）
    ├── crypto.ts           # トークン暗号化/復号化（AES-256-GCM）
    ├── signature.ts        # Slack署名検証（セキュリティ）
    ├── messages.ts         # Block Kitメッセージ生成（Phase 7）
    └── gamification.ts     # ゲーミフィケーションロジック（Phase 7）

types/
├── database.ts             # データベース型定義
└── slack.ts                # Slack関連型定義（Phase 7）

supabase/
├── schema.sql              # コアテーブル定義
├── migrations/
│   └── 20260101000000_slack_integration.sql  # Slack連携テーブル（Phase 7）
├── rls-policies.sql        # RLSポリシー
└── seed-data.sql           # 初期データ
```

### 型安全性

- データベースの型定義: [types/database.ts](tobeDataScientist/types/database.ts), [types/slack.ts](tobeDataScientist/types/slack.ts)
- Supabaseクエリの戻り値は適切に型付けする
- `AnswerOption` 型は `'a' | 'b' | 'c' | 'd'` のみ
- 主要な型:
  - `UserProfile` - ユーザープロファイル（role管理）
  - `Question` - 問題データ（4択 + 正解 + 解説）
  - `ExamSession` - 試験セッション
  - `ExamAnswer` - 個別回答記録
  - `Category` - カテゴリ（階層構造対応）
  - `SlackIntegration` - Slack連携情報（Phase 7）
  - `SlackDailyDeliverySetting` - Slack配信設定（Phase 7）
  - `SlackAnswer` - Slack回答記録（Phase 7）

## 開発フェーズと実装状況

### Phase 1: 基盤構築 ✅ 完了
- 認証機能（ログイン、新規登録、ログアウト）
- パスワードリセット・変更機能
- ダッシュボード
- ミドルウェアによる認証保護

### Phase 2: 試験機能 ✅ 完了
- 試験開始画面 ([app/exam/start/page.tsx](tobeDataScientist/app/exam/start/page.tsx))
- 試験実施画面 ([app/exam/[sessionId]/page.tsx](tobeDataScientist/app/exam/[sessionId]/page.tsx))
- 試験結果画面 ([app/exam/[sessionId]/result/page.tsx](tobeDataScientist/app/exam/[sessionId]/result/page.tsx))

### Phase 3: 管理者機能 ✅ 完了（優先度1機能）
- 問題管理画面 ([app/admin/questions/page.tsx](tobeDataScientist/app/admin/questions/page.tsx))
  - 検索・フィルタリング機能（テキスト検索、カテゴリ、承認状態、難易度、ソース）
- 問題作成・編集 ([app/admin/questions/new/page.tsx](tobeDataScientist/app/admin/questions/new/page.tsx))
- カテゴリ管理 ([app/admin/categories/page.tsx](tobeDataScientist/app/admin/categories/page.tsx))
  - 親子階層構造対応
  - 安全な削除チェック
- PDF管理 ([app/admin/pdfs/page.tsx](tobeDataScientist/app/admin/pdfs/page.tsx))

### Phase 4: AI問題生成 ✅ 完了
- AI問題生成エンドポイント ([app/api/generate-questions/route.ts](tobeDataScientist/app/api/generate-questions/route.ts))
- PDF抽出機能

### Phase 5: 学習履歴機能 ✅ 完了
- 学習履歴一覧 ([app/dashboard/history/page.tsx](tobeDataScientist/app/dashboard/history/page.tsx))
  - 統計情報（受験回数、合格回数、平均点）
  - 過去のセッション一覧
- 学習履歴詳細 ([app/dashboard/history/[id]/page.tsx](tobeDataScientist/app/dashboard/history/[id]/page.tsx))
  - 問題ごとの正解・不正解表示
  - 解説表示

### Phase 6: 管理者機能拡張 ✅ 完了（優先度2機能）
- ユーザー管理 ([app/admin/users/page.tsx](tobeDataScientist/app/admin/users/page.tsx))
  - ユーザー一覧・詳細・編集・削除
  - ロール変更機能
  - ユーザー統計表示
- 試験設定管理 ([app/admin/settings/page.tsx](tobeDataScientist/app/admin/settings/page.tsx))
  - 出題数・合格点・制限時間の設定
  - 機能の有効/無効設定
- 分析・レポート ([app/admin/analytics/page.tsx](tobeDataScientist/app/admin/analytics/page.tsx))
  - 全体統計（受験回数、合格率、平均点）
  - カテゴリ別正答率分析
  - 最近の試験活動一覧
- データエクスポート ([app/admin/export/page.tsx](tobeDataScientist/app/admin/export/page.tsx))
  - 問題データCSVエクスポート
  - 試験結果CSVエクスポート
  - ユーザーデータCSVエクスポート

### Phase 7: Slack連携機能 🚧 実装中（Phase 1完了）

**概要**: Slackワークスペースと連携し、毎日1問を自動配信する機能。

**実装済み（Phase 1: 基盤構築）**:
- データベーステーブル作成 ([supabase/migrations/20260101000000_slack_integration.sql](tobeDataScientist/supabase/migrations/20260101000000_slack_integration.sql))
  - 7つのSlack連携テーブル（integrations, settings, deliveries, answers, streaks, achievements, mappings）
  - RLSポリシーとトリガー設定
- トークン暗号化機能 ([lib/slack/crypto.ts](tobeDataScientist/lib/slack/crypto.ts))
  - AES-256-GCMによる暗号化/復号化
  - 環境変数 `SLACK_TOKEN_ENCRYPTION_KEY` を使用
- Slack署名検証 ([lib/slack/signature.ts](tobeDataScientist/lib/slack/signature.ts))
  - HMAC-SHA256による署名検証
  - リプレイ攻撃対策（5分以内のリクエストのみ許可）
- OAuth認証フロー ([app/api/slack/oauth/callback/route.ts](tobeDataScientist/app/api/slack/oauth/callback/route.ts))
  - Slack OAuth 2.0認証
  - トークン暗号化保存
- 管理画面UI ([app/admin/slack/page.tsx](tobeDataScientist/app/admin/slack/page.tsx))
  - Slack連携開始・解除
  - ワークスペース情報表示
- Slack型定義 ([types/slack.ts](tobeDataScientist/types/slack.ts))

**未実装（Phase 2-6）**:
- Phase 2: 日次配信機能（Vercel Cron、Block Kitメッセージ）
- Phase 3: 回答処理（インタラクティブボタン、結果通知）
- Phase 4: ゲーミフィケーション（連続正答日数、アチーブメント）
- Phase 5: 管理画面（配信設定、配信履歴、統計）
- Phase 6: エラーハンドリング・最適化

**詳細**: 実装計画は [SLACK_IMPLEMENTATION_PLAN.md](tobeDataScientist/SLACK_IMPLEMENTATION_PLAN.md) を参照。

### Slack連携の重要な実装パターン

**トークン暗号化**:
```typescript
import { encryptToken, decryptToken } from '@/lib/slack/crypto'

// 暗号化（OAuth時）
const encrypted = await encryptToken(accessToken)

// 復号化（API呼び出し時）
const token = await decryptToken(encryptedToken)
```

**署名検証**（セキュリティ必須）:
```typescript
import { verifySlackSignature } from '@/lib/slack/signature'

const body = await request.text()
const timestamp = request.headers.get('x-slack-request-timestamp')!
const signature = request.headers.get('x-slack-signature')!

if (!verifySlackSignature(body, timestamp, signature)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

**Slack 3秒ルール対応**:
Slackのインタラクティブエンドポイントは3秒以内に応答必須。長時間処理は非同期化する:
```typescript
export async function POST(request: NextRequest) {
  const payload = parsePayload(request)

  // 即座に200 OKを返す
  const processingPromise = handleInteraction(payload)
  processingPromise.catch(console.error)

  return NextResponse.json({ ok: true })
}
```

## Supabaseデータベースの初期セットアップ

新しい環境でセットアップする場合:

1. Supabaseプロジェクト作成 (`SUPABASE_SETUP.md` 参照)
2. `.env.local` ファイルを作成し、環境変数を設定
3. SQL Editorで [supabase/schema.sql](tobeDataScientist/supabase/schema.sql) を実行
4. SQL Editorで [supabase/rls-policies.sql](tobeDataScientist/supabase/rls-policies.sql) を実行
5. (オプション) Slack連携を使う場合: [supabase/migrations/20260101000000_slack_integration.sql](tobeDataScientist/supabase/migrations/20260101000000_slack_integration.sql) を実行
6. (オプション) 初期データ投入: [supabase/seed-data.sql](tobeDataScientist/supabase/seed-data.sql) を実行
7. Storage バケット `exam-pdfs` を作成（プライベート設定）

## よくある開発タスク

### 新しい問題を手動で追加する
1. 管理者としてログイン
2. `/admin/questions/new` にアクセス
3. カテゴリ、問題文、選択肢、正解、解説を入力
4. `is_approved` を `true` にして保存

### 試験を実施する
1. `/exam/start` で出題数とカテゴリを選択
2. 試験セッションが作成され、`/exam/[sessionId]` にリダイレクト
3. 問題に回答後、`/exam/[sessionId]/result` で結果表示

### RLSポリシーをデバッグする
- Supabase Studio の「SQL Editor」で直接クエリを実行
- `auth.uid()` で現在のユーザーIDを確認: `SELECT auth.uid();`
- ユーザーのロールを確認: `SELECT role FROM user_profiles WHERE id = auth.uid();`

### Slack連携のセットアップ（Phase 7使用時）

1. Slack Appを作成（https://api.slack.com/apps）
2. OAuth & Permissions でBot Token Scopesを追加:
   - `chat:write`, `chat:write.public`, `channels:read`, `users:read`, `im:write`
3. OAuth Redirect URLsを設定:
   - 開発環境: `http://localhost:3000/api/slack/oauth/callback`
   - 本番環境: `https://your-app.vercel.app/api/slack/oauth/callback`
4. Interactivity & Shortcuts でRequest URLを設定:
   - `https://your-app.vercel.app/api/slack/interactions`
5. 環境変数を設定（`.env.local`）:
   - `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
   - `SLACK_TOKEN_ENCRYPTION_KEY`（`openssl rand -hex 32`で生成）
   - `CRON_SECRET`（`openssl rand -hex 32`で生成）
6. `/admin/slack` にアクセスして「Slackと連携する」をクリック

## 参考ドキュメント

- 要件定義: [REQUIREMENTS.md](tobeDataScientist/REQUIREMENTS.md)
- プロジェクト構造: [PROJECT_STRUCTURE.md](tobeDataScientist/PROJECT_STRUCTURE.md)
- Supabaseセットアップ: [SUPABASE_SETUP.md](tobeDataScientist/SUPABASE_SETUP.md)
- Slack連携実装計画: [SLACK_IMPLEMENTATION_PLAN.md](tobeDataScientist/SLACK_IMPLEMENTATION_PLAN.md)
