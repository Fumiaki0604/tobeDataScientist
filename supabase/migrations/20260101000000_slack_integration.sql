-- Slack連携機能のテーブル作成
-- Phase 1: 基盤構築

-- 1. Slack連携情報テーブル
CREATE TABLE IF NOT EXISTS public.slack_integrations (
    id SERIAL PRIMARY KEY,
    workspace_id TEXT NOT NULL UNIQUE,
    workspace_name TEXT NOT NULL,
    team_name TEXT,

    -- OAuth情報（暗号化して保存）
    access_token_encrypted TEXT NOT NULL,
    bot_user_id TEXT NOT NULL,

    -- インストール情報
    installed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 状態管理
    is_active BOOLEAN DEFAULT TRUE,
    last_health_check TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 日次配信設定テーブル
CREATE TABLE IF NOT EXISTS public.slack_daily_delivery_settings (
    id SERIAL PRIMARY KEY,
    slack_integration_id INTEGER NOT NULL REFERENCES public.slack_integrations(id) ON DELETE CASCADE,

    -- 配信設定
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    delivery_time TIME NOT NULL DEFAULT '09:00:00', -- JST 9:00
    timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',

    -- 出題設定
    category_ids INTEGER[], -- NULL = 全カテゴリ
    difficulty_min INTEGER DEFAULT 1,
    difficulty_max INTEGER DEFAULT 5,
    only_approved BOOLEAN DEFAULT TRUE,

    -- 状態
    is_enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(slack_integration_id, channel_id)
);

-- 3. 日次配信実績ログテーブル
CREATE TABLE IF NOT EXISTS public.slack_daily_deliveries (
    id SERIAL PRIMARY KEY,
    setting_id INTEGER NOT NULL REFERENCES public.slack_daily_delivery_settings(id) ON DELETE CASCADE,

    -- 配信情報
    question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Slack メッセージ情報
    message_ts TEXT NOT NULL, -- Slackのタイムスタンプ（メッセージID）
    channel_id TEXT NOT NULL,

    -- ステータス
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'expired')),
    error_message TEXT,

    -- 統計
    total_responses INTEGER DEFAULT 0,
    correct_responses INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Slack回答記録テーブル
CREATE TABLE IF NOT EXISTS public.slack_answers (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES public.slack_daily_deliveries(id) ON DELETE CASCADE,

    -- Slackユーザー情報
    slack_user_id TEXT NOT NULL,
    slack_username TEXT,

    -- Supabaseユーザー紐付け（オプション）
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- 回答情報
    question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_answer TEXT NOT NULL CHECK (user_answer IN ('a', 'b', 'c', 'd')),
    is_correct BOOLEAN NOT NULL,

    -- タイミング
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_since_delivery_ms BIGINT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 同一問題への重複回答を防止
    UNIQUE(delivery_id, slack_user_id)
);

-- 5. ゲーミフィケーション：連続正答日数テーブル
CREATE TABLE IF NOT EXISTS public.slack_gamification_streaks (
    id SERIAL PRIMARY KEY,
    slack_integration_id INTEGER NOT NULL REFERENCES public.slack_integrations(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    slack_username TEXT,

    -- ユーザー紐付け
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- 連続記録
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_answer_date DATE,

    -- 統計
    total_answers INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    accuracy_percentage DECIMAL(5,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(slack_integration_id, slack_user_id)
);

-- 6. アチーブメント・バッジテーブル
CREATE TABLE IF NOT EXISTS public.slack_achievements (
    id SERIAL PRIMARY KEY,
    streak_id INTEGER NOT NULL REFERENCES public.slack_gamification_streaks(id) ON DELETE CASCADE,

    -- バッジ情報
    achievement_type TEXT NOT NULL CHECK (
        achievement_type IN (
            'streak_3',      -- 3日連続
            'streak_7',      -- 1週間連続
            'streak_30',     -- 1ヶ月連続
            'perfect_10',    -- 10問連続正解
            'first_answer',  -- 初回答
            'speed_demon'    -- 配信後5分以内に回答
        )
    ),
    achievement_name TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(streak_id, achievement_type)
);

-- 7. Slackユーザー・Supabaseユーザー紐付けテーブル（オプション）
CREATE TABLE IF NOT EXISTS public.slack_user_mappings (
    id SERIAL PRIMARY KEY,
    slack_integration_id INTEGER NOT NULL REFERENCES public.slack_integrations(id) ON DELETE CASCADE,
    slack_user_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 紐付け方法
    mapping_method TEXT CHECK (mapping_method IN ('oauth', 'email_match', 'manual')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(slack_integration_id, slack_user_id),
    UNIQUE(slack_integration_id, user_id)
);

-- インデックス作成
CREATE INDEX idx_slack_daily_deliveries_delivered_at ON public.slack_daily_deliveries(delivered_at);
CREATE INDEX idx_slack_daily_deliveries_message_ts ON public.slack_daily_deliveries(message_ts);
CREATE INDEX idx_slack_answers_slack_user ON public.slack_answers(slack_user_id);
CREATE INDEX idx_slack_answers_delivery ON public.slack_answers(delivery_id);
CREATE INDEX idx_slack_gamification_streaks_user ON public.slack_gamification_streaks(slack_user_id);
CREATE INDEX idx_slack_integrations_workspace ON public.slack_integrations(workspace_id);

-- RLSポリシー設定

-- slack_integrations のRLS
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage slack integrations"
    ON public.slack_integrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_daily_delivery_settings のRLS
ALTER TABLE public.slack_daily_delivery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage delivery settings"
    ON public.slack_daily_delivery_settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_daily_deliveries のRLS（管理者のみ閲覧）
ALTER TABLE public.slack_daily_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deliveries"
    ON public.slack_daily_deliveries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_answers のRLS（自分の回答のみ閲覧可能、管理者は全て）
ALTER TABLE public.slack_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slack answers"
    ON public.slack_answers FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all slack answers"
    ON public.slack_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_gamification_streaks のRLS
ALTER TABLE public.slack_gamification_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks"
    ON public.slack_gamification_streaks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all streaks"
    ON public.slack_gamification_streaks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_achievements のRLS
ALTER TABLE public.slack_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
    ON public.slack_achievements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.slack_gamification_streaks
            WHERE id = slack_achievements.streak_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all achievements"
    ON public.slack_achievements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- slack_user_mappings のRLS
ALTER TABLE public.slack_user_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mappings"
    ON public.slack_user_mappings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all mappings"
    ON public.slack_user_mappings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 配信統計更新用のストアドプロシージャ
CREATE OR REPLACE FUNCTION increment_delivery_stats(
    p_delivery_id INTEGER,
    p_is_correct BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE public.slack_daily_deliveries
    SET
        total_responses = total_responses + 1,
        correct_responses = CASE
            WHEN p_is_correct THEN correct_responses + 1
            ELSE correct_responses
        END
    WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_slack_integrations_updated_at
    BEFORE UPDATE ON public.slack_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_daily_delivery_settings_updated_at
    BEFORE UPDATE ON public.slack_daily_delivery_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_gamification_streaks_updated_at
    BEFORE UPDATE ON public.slack_gamification_streaks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
