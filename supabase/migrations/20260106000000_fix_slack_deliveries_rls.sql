-- slack_daily_deliveries テーブルに管理者用のINSERT/UPDATEポリシーを追加

-- 既存のポリシーはそのまま（SELECT用）

-- INSERTポリシーを追加（管理者のみ）
CREATE POLICY "Admins can insert deliveries"
    ON public.slack_daily_deliveries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- UPDATEポリシーを追加（管理者のみ）
CREATE POLICY "Admins can update deliveries"
    ON public.slack_daily_deliveries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- サービスロール（Cron Job用）は自動的にRLSをバイパスするため、別途ポリシーは不要
