# プロジェクト構造

## ディレクトリ構成

```
ds-exam-app/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   ├── auth/                # 認証関連ページ
│   ├── dashboard/           # ダッシュボード
│   ├── exam/                # 試験画面
│   ├── admin/               # 管理者画面
│   ├── layout.tsx           # ルートレイアウト
│   └── page.tsx             # トップページ
├── components/              # Reactコンポーネント
│   ├── ui/                  # 共通UIコンポーネント
│   ├── auth/                # 認証コンポーネント
│   ├── exam/                # 試験関連コンポーネント
│   └── admin/               # 管理者用コンポーネント
├── lib/                     # ライブラリとユーティリティ
│   ├── supabase/           # Supabaseクライアント
│   │   ├── client.ts       # ブラウザ用クライアント
│   │   ├── server.ts       # サーバー用クライアント
│   │   └── middleware.ts   # ミドルウェア用
│   └── utils/              # ヘルパー関数
├── types/                   # TypeScript型定義
│   └── database.ts         # データベース型
├── supabase/               # Supabaseスキーマ
│   ├── schema.sql          # テーブル定義
│   └── rls-policies.sql    # RLSポリシー
├── public/                  # 静的ファイル
├── .env.local              # 環境変数（ローカル）
├── .env.example            # 環境変数テンプレート
├── middleware.ts           # Next.js ミドルウェア
├── REQUIREMENTS.md         # 要件定義書
├── SUPABASE_SETUP.md       # Supabaseセットアップガイド
└── PROJECT_STRUCTURE.md    # このファイル
```

## 主要ファイルの説明

### アプリケーションルート (`app/`)

#### 認証 (`app/auth/`)
- `login/page.tsx` - ログインページ
- `signup/page.tsx` - 新規登録ページ
- `callback/route.ts` - OAuth コールバック

#### ダッシュボード (`app/dashboard/`)
- `page.tsx` - ユーザーダッシュボード
- `history/page.tsx` - 学習履歴一覧
- `history/[id]/page.tsx` - 学習履歴詳細

#### 試験 (`app/exam/`)
- `setup/page.tsx` - 試験設定画面
- `[sessionId]/page.tsx` - 試験実施画面
- `result/[sessionId]/page.tsx` - 試験結果画面

#### 管理者 (`app/admin/`)
- `page.tsx` - 管理ダッシュボード
- `questions/page.tsx` - 問題管理
- `questions/new/page.tsx` - 問題作成
- `questions/[id]/edit/page.tsx` - 問題編集
- `pdfs/page.tsx` - PDF管理
- `settings/page.tsx` - 試験設定
- `users/page.tsx` - ユーザー管理
- `analytics/page.tsx` - 成績分析

#### API Routes (`app/api/`)
- `questions/route.ts` - 問題一覧取得・作成
- `questions/[id]/route.ts` - 問題詳細・更新・削除
- `exam/start/route.ts` - 試験開始
- `exam/submit/route.ts` - 回答送信
- `exam/finish/route.ts` - 試験終了
- `ai/generate/route.ts` - AI問題生成
- `pdf/upload/route.ts` - PDFアップロード
- `pdf/extract/route.ts` - PDF問題抽出

### コンポーネント (`components/`)

#### UI コンポーネント (`components/ui/`)
- `Button.tsx` - ボタン
- `Input.tsx` - 入力フィールド
- `Card.tsx` - カード
- `Modal.tsx` - モーダル
- `Table.tsx` - テーブル
- `Chart.tsx` - グラフ

#### 認証 (`components/auth/`)
- `LoginForm.tsx` - ログインフォーム
- `SignupForm.tsx` - 登録フォーム
- `AuthGuard.tsx` - 認証ガード

#### 試験 (`components/exam/`)
- `QuestionCard.tsx` - 問題カード
- `AnswerOptions.tsx` - 回答選択肢
- `Timer.tsx` - タイマー
- `ProgressBar.tsx` - 進捗バー
- `ResultSummary.tsx` - 結果サマリー

#### 管理者 (`components/admin/`)
- `QuestionForm.tsx` - 問題フォーム
- `QuestionList.tsx` - 問題一覧
- `PdfUploader.tsx` - PDFアップローダー
- `UserTable.tsx` - ユーザーテーブル
- `AnalyticsChart.tsx` - 分析グラフ

### ライブラリ (`lib/`)

#### Supabase (`lib/supabase/`)
- `client.ts` - クライアントサイド用Supabaseクライアント
- `server.ts` - サーバーサイド用Supabaseクライアント
- `middleware.ts` - ミドルウェア用Supabaseクライアント

#### ユーティリティ (`lib/utils/`)
- `questions.ts` - 問題関連ヘルパー
- `scoring.ts` - 採点ロジック
- `analytics.ts` - 分析ロジック
- `pdf.ts` - PDF処理

### 型定義 (`types/`)
- `database.ts` - データベーステーブルの型定義
- `api.ts` - API レスポンスの型定義
- `components.ts` - コンポーネントの Props 型定義

## 開発の流れ

### 1. 環境セットアップ
1. `.env.local` ファイルを作成（`.env.example` をコピー）
2. Supabaseプロジェクトを作成（`SUPABASE_SETUP.md` 参照）
3. `supabase/schema.sql` を実行してテーブルを作成
4. `supabase/rls-policies.sql` を実行してRLSを設定

### 2. 開発サーバー起動
```bash
npm run dev
```

### 3. 開発順序（推奨）
1. 認証機能（ログイン・登録）
2. ユーザーダッシュボード
3. 試験機能（問題表示・回答・採点）
4. 管理者機能（問題管理）
5. PDF管理
6. AI連携
7. 分析機能

## 技術スタック詳細

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **AI**: OpenAI API
- **デプロイ**: Vercel
- **状態管理**: React Server Components + Client Components
- **フォーム**: React Hook Form (追加予定)
- **バリデーション**: Zod (追加予定)
- **グラフ**: Recharts

## 次のステップ

### Phase 1: 認証機能実装（完了予定）
- [ ] ログインページ作成
- [ ] 新規登録ページ作成
- [ ] 認証コールバック実装
- [ ] ミドルウェアでの認証チェック
- [ ] ユーザープロファイル自動作成

### Phase 2: 基本機能実装
- [ ] ダッシュボード作成
- [ ] 試験設定画面
- [ ] 試験実施画面
- [ ] 結果表示画面

### Phase 3: 管理者機能
- [ ] 問題CRUD
- [ ] カテゴリ管理
- [ ] ユーザー管理

### Phase 4: 拡張機能
- [ ] PDF管理
- [ ] AI問題生成
- [ ] 学習履歴分析
- [ ] データエクスポート
