# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語設定

**すべての回答は日本語で行ってください。**

## プロジェクト概要

データサイエンティスト検定リテラシーレベルの試験対策用Webアプリケーション。
AIが問題を生成し、ユーザーが回答、正答率と合格可能性を判定する。

## 開発コマンド

```bash
# 開発サーバー起動
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
例: ログアウト処理は `app/dashboard/page.tsx` 参照。

### 型安全性

- データベースの型定義: `types/database.ts`
- Supabaseクエリの戻り値は適切に型付けする
- `AnswerOption` 型は `'a' | 'b' | 'c' | 'd'` のみ

## 開発フェーズと実装状況

### Phase 1: 基盤構築 ✅ 完了
- 認証機能（ログイン、新規登録、ログアウト）
- ダッシュボード

### Phase 2-7: 未実装
- 試験機能（問題表示、回答、採点）
- 問題管理（CRUD）
- AI問題生成
- 学習履歴・分析
- PDF管理

## Supabaseデータベースの初期セットアップ

新しい環境でセットアップする場合:

1. Supabaseプロジェクト作成 (`SUPABASE_SETUP.md` 参照)
2. SQL Editorで `supabase/schema.sql` 実行
3. SQL Editorで `supabase/rls-policies.sql` 実行
4. Storage バケット `exam-pdfs` を作成

## 参考ドキュメント

- 要件定義: `REQUIREMENTS.md`
- プロジェクト構造: `PROJECT_STRUCTURE.md`
- Supabaseセットアップ: `SUPABASE_SETUP.md`
