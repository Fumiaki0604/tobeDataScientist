# Supabase セットアップガイド

## 1. Supabaseプロジェクトの作成

### 1.1 アカウント作成
1. https://supabase.com にアクセス
2. 「Start your project」をクリック
3. GitHubアカウントでサインアップ（推奨）

### 1.2 新規プロジェクト作成
1. ダッシュボードで「New Project」をクリック
2. 以下を入力:
   - **Name**: `ds-exam-app` (または任意の名前)
   - **Database Password**: 強力なパスワードを生成して保存
   - **Region**: `Northeast Asia (Tokyo)` (日本リージョン)
   - **Pricing Plan**: `Free` (無料プラン)
3. 「Create new project」をクリック
4. プロジェクトの準備完了まで1-2分待機

## 2. API認証情報の取得

### 2.1 Project Settings へ移動
1. 左サイドバーの「Settings」(歯車アイコン)をクリック
2. 「API」を選択

### 2.2 必要な情報をコピー
以下の情報をコピーしてメモ:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGc...` (長いトークン)
- **service_role key**: `eyJhbGc...` (管理者用、慎重に扱う)

## 3. 環境変数の設定

### 3.1 ローカル開発用
プロジェクトルートに `.env.local` ファイルを作成:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# OpenAI (後で設定)
OPENAI_API_KEY=sk-...
```

### 3.2 Vercel デプロイ用
Vercelのプロジェクト設定で環境変数を追加:
1. Vercelダッシュボードでプロジェクトを選択
2. 「Settings」→「Environment Variables」
3. 上記の環境変数を追加

## 4. データベーススキーマの作成

### 4.1 SQL Editorへ移動
1. 左サイドバーの「SQL Editor」をクリック
2. 「New Query」をクリック

### 4.2 スキーマSQLを実行
`supabase/schema.sql` ファイルの内容をコピーして実行

## 5. Row Level Security (RLS) の設定

### 5.1 RLS ポリシーの有効化
各テーブルでRLSを有効化し、適切なポリシーを設定

詳細は `supabase/rls-policies.sql` を参照

## 6. Storage (ファイルストレージ) の設定

### 6.1 PDF保存用バケット作成
1. 左サイドバーの「Storage」をクリック
2. 「New Bucket」をクリック
3. バケット名: `exam-pdfs`
4. Public: `off` (プライベート)
5. 「Create bucket」をクリック

### 6.2 Storage ポリシー設定
- 管理者のみアップロード可能
- 全ユーザーが読み取り可能

## 7. 認証設定

### 7.1 Email認証の有効化
1. 左サイドバーの「Authentication」→「Settings」
2. 「Email」が有効になっていることを確認
3. Email確認の設定:
   - 「Enable email confirmations」をON (本番環境)
   - 開発中はOFFでも可

### 7.2 リダイレクトURLの設定
「URL Configuration」セクションで:
- **Site URL**: `http://localhost:3000` (開発)
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback`
  - `https://yourdomain.vercel.app/auth/callback` (本番)

## 8. Supabase CLIのインストール (オプション)

ローカルでSupabaseを実行する場合:

```bash
npm install -g supabase

# プロジェクトの初期化
supabase init

# ローカルSupabaseの起動
supabase start

# マイグレーションの生成
supabase db diff -f migration_name

# リモートへのプッシュ
supabase db push
```

## 9. 次のステップ

1. ✅ Supabaseプロジェクト作成
2. ✅ API認証情報取得
3. ✅ 環境変数設定
4. ⏳ データベーススキーマ作成
5. ⏳ RLSポリシー設定
6. ⏳ アプリケーションとの統合

## トラブルシューティング

### データベース接続エラー
- 環境変数が正しく設定されているか確認
- Supabase URLとキーにタイポがないか確認

### 認証エラー
- リダイレクトURLが正しく設定されているか確認
- Email確認が必要な場合、メールを確認

### RLSエラー
- ポリシーが正しく設定されているか確認
- ユーザーの権限を確認

## 参考リンク

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Supabase + Next.js ガイド](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
