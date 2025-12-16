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
- **TypeScript** - 型定義は `types/database.ts` を参照
- **Tailwind CSS** - スタイリング
- **OpenAI API** - AI問題生成 (gpt-4など)
- **pdf-parse** - PDFファイルからのテキスト抽出
- **Recharts** - データ可視化・グラフ表示

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

**8つの主要テーブル**:
1. `user_profiles` - ユーザー情報拡張 (role管理)
2. `categories` - 階層構造のカテゴリ (parent_id)
3. `questions` - 4択問題 (is_approved フラグ重要)
4. `exam_sessions` - 試験セッション
5. `exam_answers` - 個別回答記録
6. `exam_settings` - グローバル設定
7. `pdf_sources` - PDFファイル管理
8. `ai_generation_logs` - AI生成履歴

詳細は `supabase/schema.sql` を参照。

## 開発時の注意点

### 環境変数

`.env.local` ファイルが必要（`.env.example` をコピー）:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

### Server Actions

Server Actionsを使用する場合は `'use server'` ディレクティブが必要。
例: ログアウト処理は [app/dashboard/page.tsx:23-28](tobeDataScientist/app/dashboard/page.tsx#L23-L28) を参照。

### ディレクトリ構造

```
app/
├── api/                      # API Routes
│   └── generate-questions/   # AI問題生成エンドポイント
├── auth/                     # 認証関連
│   ├── login/               # ログイン
│   ├── signup/              # 新規登録
│   └── callback/            # OAuth コールバック
├── dashboard/               # ダッシュボード
├── exam/                    # 試験機能
│   ├── start/              # 試験設定・開始
│   └── [sessionId]/        # 試験実施・結果
└── admin/                   # 管理者機能
    ├── questions/          # 問題管理
    └── pdfs/               # PDF管理

lib/
└── supabase/               # Supabaseクライアント設定

types/
└── database.ts             # データベース型定義

supabase/
├── schema.sql              # テーブル定義
├── rls-policies.sql        # RLSポリシー
└── seed-data.sql           # 初期データ
```

### 型安全性

- データベースの型定義: [types/database.ts](tobeDataScientist/types/database.ts)
- Supabaseクエリの戻り値は適切に型付けする
- `AnswerOption` 型は `'a' | 'b' | 'c' | 'd'` のみ
- 主要な型:
  - `UserProfile` - ユーザープロファイル（role管理）
  - `Question` - 問題データ（4択 + 正解 + 解説）
  - `ExamSession` - 試験セッション
  - `ExamAnswer` - 個別回答記録
  - `Category` - カテゴリ（階層構造対応）

## 開発フェーズと実装状況

### Phase 1: 基盤構築 ✅ 完了
- 認証機能（ログイン、新規登録、ログアウト）
- ダッシュボード
- ミドルウェアによる認証保護

### Phase 2: 試験機能 🚧 部分的に実装
- 試験開始画面 ([app/exam/start/page.tsx](tobeDataScientist/app/exam/start/page.tsx))
- 試験実施画面 ([app/exam/[sessionId]/page.tsx](tobeDataScientist/app/exam/[sessionId]/page.tsx))
- 試験結果画面 ([app/exam/[sessionId]/result/page.tsx](tobeDataScientist/app/exam/[sessionId]/result/page.tsx))

### Phase 3: 管理者機能 🚧 部分的に実装
- 問題管理画面 ([app/admin/questions/page.tsx](tobeDataScientist/app/admin/questions/page.tsx))
- 問題作成・編集 ([app/admin/questions/new/page.tsx](tobeDataScientist/app/admin/questions/new/page.tsx))
- PDF管理 ([app/admin/pdfs/page.tsx](tobeDataScientist/app/admin/pdfs/page.tsx))

### Phase 4-7: 未実装
- AI問題生成の完全統合
- 学習履歴・詳細分析
- カテゴリ管理UI
- データエクスポート機能

## Supabaseデータベースの初期セットアップ

新しい環境でセットアップする場合:

1. Supabaseプロジェクト作成 (`SUPABASE_SETUP.md` 参照)
2. `.env.local` ファイルを作成し、環境変数を設定
3. SQL Editorで [supabase/schema.sql](tobeDataScientist/supabase/schema.sql) を実行
4. SQL Editorで [supabase/rls-policies.sql](tobeDataScientist/supabase/rls-policies.sql) を実行
5. (オプション) 初期データ投入: [supabase/seed-data.sql](tobeDataScientist/supabase/seed-data.sql) を実行
6. Storage バケット `exam-pdfs` を作成（プライベート設定）

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

## 参考ドキュメント

- 要件定義: [REQUIREMENTS.md](tobeDataScientist/REQUIREMENTS.md)
- プロジェクト構造: [PROJECT_STRUCTURE.md](tobeDataScientist/PROJECT_STRUCTURE.md)
- Supabaseセットアップ: [SUPABASE_SETUP.md](tobeDataScientist/SUPABASE_SETUP.md)
