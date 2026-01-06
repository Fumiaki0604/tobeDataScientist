# GitHub Actions でのCron設定

Vercel Cron Jobsは有料プラン（Pro以上）でのみ利用可能なため、無料のGitHub Actionsを使用して日次配信を実現します。

## 設定手順

### 1. GitHub Secretsの設定

GitHubリポジトリの Settings → Secrets and variables → Actions から、以下のSecretを追加します。

1. リポジトリページで **Settings** タブをクリック
2. 左サイドバーから **Secrets and variables** → **Actions** を選択
3. **New repository secret** ボタンをクリック
4. 以下のSecretを追加:

**Secret名:** `CRON_SECRET`
**値:** `.env.local` の `CRON_SECRET` と同じ値

```bash
# .env.localから値を確認
cat .env.local | grep CRON_SECRET
```

### 2. ワークフローファイルの確認

`.github/workflows/daily-slack-delivery.yml` が既に作成されています。

**実行スケジュール:**
- 毎日 UTC 0:00 (JST 9:00) に自動実行
- 手動実行も可能（Actionsタブから）

### 3. 配信時刻の変更方法

配信時刻を変更したい場合は、`.github/workflows/daily-slack-delivery.yml` の `cron` 設定を編集します。

```yaml
schedule:
  # 例: 毎日 UTC 23:00 (JST 8:00) に実行
  - cron: '0 23 * * *'
```

**Cron式の例:**
- `0 0 * * *` - 毎日 UTC 0:00 (JST 9:00)
- `0 23 * * *` - 毎日 UTC 23:00 (JST 8:00)
- `30 1 * * *` - 毎日 UTC 1:30 (JST 10:30)

**注意:** GitHubのスケジュールはUTC時刻で指定します。JSTはUTC+9時間です。

### 4. 動作確認

#### 手動実行でテスト

1. GitHubリポジトリの **Actions** タブを開く
2. 左サイドバーから **Daily Slack Question Delivery** を選択
3. **Run workflow** ボタンをクリック
4. **Run workflow** を再度クリックして実行

#### 実行履歴の確認

- Actionsタブでワークフローの実行履歴を確認できます
- 各実行をクリックすると詳細ログが表示されます
- エラーが発生した場合は、ログを確認してトラブルシューティングできます

### 5. 配信設定との連携

GitHub Actionsは `/api/cron/send-daily-questions` を呼び出します。このAPIは内部で以下をチェックします:

1. **配信設定の有効性** - `slack_daily_delivery_settings` の `is_active` が true
2. **配信時刻** - 設定された `delivery_time` の ±5分以内
3. **重複防止** - 今日既に配信済みでないか確認

そのため、**配信設定UI (`/admin/slack/settings`)** で以下を設定する必要があります:
- 配信先チャンネル
- 配信時刻（GitHub Actionsの実行時刻と合わせる）
- 配信を有効にする

### トラブルシューティング

#### エラー: 401 Unauthorized

**原因:** `CRON_SECRET` が正しく設定されていない

**解決策:**
1. GitHub Secretsの `CRON_SECRET` を確認
2. Vercelの環境変数 `CRON_SECRET` を確認
3. `.env.local` の値と一致しているか確認

#### エラー: 404 No active Slack integration

**原因:** Slack連携が設定されていない

**解決策:**
1. `/admin/slack` でSlackワークスペースを連携
2. Slack Appが正しく設定されているか確認

#### エラー: No active delivery settings

**原因:** 配信設定が有効になっていない

**解決策:**
1. `/admin/slack/settings` で配信設定を作成
2. 「配信を有効にする」にチェックが入っているか確認

#### ワークフローが実行されない

**原因:** GitHub Actionsが無効化されている、またはリポジトリがforkされている

**解決策:**
1. Settings → Actions → General で Actions が有効になっているか確認
2. Forkしたリポジトリの場合、Actionsタブで手動で有効化が必要

### コスト

GitHub Actionsは以下の無料枠があります:
- **パブリックリポジトリ:** 完全無料・無制限
- **プライベートリポジトリ:** 月2000分まで無料

1日1回（1-2分）の実行であれば、プライベートリポジトリでも無料枠内で十分です。

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Syntax](https://crontab.guru/)
- [GitHub Actions Pricing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
