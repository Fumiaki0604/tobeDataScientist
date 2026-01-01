# Slack連携機能 実装計画書

## 概要

毎日1問をSlack経由で配信し、インタラクティブボタンで回答を受け付ける機能を実装します。

## 要件

- 毎日決まった時間（例：朝9時）に1問を任意のSlackチャンネルに自動配信
- Slackのインタラクティブボタン（Block Kit）で回答
- 回答後、正解・不正解を即座にSlackで通知
- 連続正答日数などのゲーミフィケーション要素
- Slack OAuth連携でアカウント自動紐付け

## アーキテクチャ

```
Slack Workspace
    ↓ (Webhook/Interactive)
Next.js App (Vercel)
    - API Routes (OAuth, Interactions, Cron)
    - Admin UI
    ↓
Supabase PostgreSQL
    - slack_integrations
    - slack_daily_delivery_settings
    - slack_daily_deliveries
    - slack_answers
    - slack_gamification_streaks
    - slack_achievements
```

## 実装フェーズ

### Phase 1: 基盤構築（DB、OAuth）【2-3日】

**目的:** Slack OAuth認証とデータベース基盤を構築

**タスク:**
1. データベーステーブル作成
2. 環境変数設定
3. Slack App作成・設定
4. OAuth認証フロー実装
5. トークン暗号化機能実装

**成果物:**
- `supabase/migrations/001_slack_integration.sql`
- `lib/slack/crypto.ts`
- `app/api/slack/oauth/callback/route.ts`
- 管理画面の基本UI

### Phase 2: 日次配信機能【2-3日】

**目的:** Vercel Cronで毎日問題を配信

**タスク:**
1. Vercel Cron設定（`vercel.json`）
2. 日次配信API実装
3. Block Kitメッセージ作成
4. 配信設定管理UI
5. 配信ログ機能

**成果物:**
- `app/api/cron/send-daily-questions/route.ts`
- `lib/slack/messages.ts`
- `/app/admin/slack/settings/page.tsx`

### Phase 3: 回答処理【2-3日】

**目的:** Slackのインタラクティブボタンで回答処理

**タスク:**
1. Interactive API実装
2. 署名検証（セキュリティ）
3. 回答判定ロジック
4. 結果通知メッセージ
5. 重複回答チェック

**成果物:**
- `app/api/slack/interactions/route.ts`
- `lib/slack/signature.ts`

### Phase 4: ゲーミフィケーション【2日】

**目的:** 連続正答日数とアチーブメント

**タスク:**
1. 連続正答日数計算ロジック
2. アチーブメント判定
3. バッジ授与機能
4. 統計表示

**成果物:**
- `lib/slack/gamification.ts`

### Phase 5: 管理画面【2-3日】

**目的:** 管理者が設定・監視できるUI

**タスク:**
1. Slack連携設定画面
2. 配信設定画面
3. 配信履歴・統計ダッシュボード
4. ユーザー統計表示
5. エラーログ表示

**成果物:**
- `/app/admin/slack/page.tsx`
- `/app/admin/slack/settings/page.tsx`
- `/app/admin/slack/history/page.tsx`

### Phase 6: エラーハンドリング・最適化【1-2日】

**目的:** 本番運用の安定性確保

**タスク:**
1. エラーハンドリング強化
2. リトライロジック
3. ロギング改善
4. パフォーマンス最適化
5. セキュリティ監査

**合計見積もり:** 11-16日

## データベース設計

### 新規テーブル

1. **slack_integrations** - Slack OAuth情報とワークスペース連携
2. **slack_daily_delivery_settings** - 配信設定（時刻、チャンネル）
3. **slack_daily_deliveries** - 配信実績ログ
4. **slack_answers** - Slackからの回答記録
5. **slack_gamification_streaks** - 連続正答日数管理
6. **slack_achievements** - アチーブメント・バッジ
7. **slack_user_mappings** - SlackユーザーとSupabaseユーザーの紐付け（オプション）

詳細なスキーマは `supabase/migrations/001_slack_integration.sql` を参照。

## 環境変数

```bash
# Slack App Credentials
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret

# Slack Token Encryption (32 bytes hex)
SLACK_TOKEN_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32

# Vercel Cron Secret
CRON_SECRET=your_random_secret_string
```

暗号化鍵の生成: `openssl rand -hex 32`

## Slack App設定

**Bot Token Scopes:**
- `chat:write` - メッセージ送信
- `chat:write.public` - 未参加チャンネルへの送信
- `channels:read` - チャンネル一覧取得
- `users:read` - ユーザー情報取得
- `im:write` - DMメッセージ送信

**OAuth Redirect URL:**
- `https://your-app.vercel.app/api/slack/oauth/callback`

**Interactive Components:**
- `https://your-app.vercel.app/api/slack/interactions`

## セキュリティ対策

1. **トークン暗号化:** AES-256-GCMで暗号化してDB保存
2. **署名検証:** Slack Signing Secretを使った署名検証（リプレイ攻撃対策含む）
3. **タイムスタンプチェック:** 5分以上古いリクエストを拒否
4. **RLSポリシー:** 管理者のみSlack設定を変更可能

## テスト戦略

### 開発環境

1. テスト用Slackワークスペース作成
2. ngrokでローカル環境を公開
3. Slack AppのRequest URLを設定

### テスト手順

**Phase 1:**
1. OAuth認証フローの動作確認
2. DBにトークンが暗号化されて保存されることを確認

**Phase 2:**
1. Cron APIを手動実行
2. Slackチャンネルに問題が配信されることを確認

**Phase 3:**
1. ボタンをクリックして回答
2. 正解/不正解のメッセージが届くことを確認
3. DBに回答が記録されることを確認

**Phase 4:**
1. 連続3日間正解してバッジ授与を確認
2. 統計が正しく更新されることを確認

**Phase 5:**
1. 管理画面で各種設定・統計表示を確認

## リスクと考慮事項

### セキュリティ
- トークン暗号化は必須
- 署名検証でなりすまし防止
- 環境変数の適切な管理

### スケーラビリティ
- Slack API Rate Limit対策（バッチ処理）
- 配信ログのアーカイブ戦略
- インデックス最適化

### エラーハンドリング
- Slack API障害時のリトライ
- トークン期限切れ対応
- 3秒ルール対応（即座に200 OK返却）

### タイムゾーン
- DBは全てUTCで保存
- 配信設定でタイムゾーン指定可能
- Vercel CronはUTC時刻で動作

## ファイル構成

### 新規作成

```
supabase/migrations/001_slack_integration.sql
lib/slack/crypto.ts
lib/slack/signature.ts
lib/slack/messages.ts
lib/slack/gamification.ts
app/api/slack/oauth/callback/route.ts
app/api/slack/interactions/route.ts
app/api/cron/send-daily-questions/route.ts
app/admin/slack/page.tsx
app/admin/slack/settings/page.tsx
app/admin/slack/history/page.tsx
types/slack.ts
vercel.json
```

### 変更

```
.env.example - Slack環境変数追加
package.json - @slack/web-api, @slack/bolt追加
app/admin/page.tsx - Slack連携メニュー追加
types/database.ts - Slack型定義追加
```

## 実装開始前チェックリスト

- [ ] Slackワークスペース準備（テスト用）
- [ ] Slack App作成
- [ ] 環境変数設定
- [ ] パッケージインストール（`@slack/web-api`等）
- [ ] データベースマイグレーション準備

## 次のステップ

Phase 1から順番に実装を開始します。各フェーズ完了後に動作確認を行い、問題なければ次のフェーズに進みます。
