-- Row Level Security (RLS) ポリシー設定

-- 1. user_profiles テーブルのRLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロファイルは読み取り可能
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- 管理者は全てのプロファイルを閲覧可能
CREATE POLICY "Admins can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 自分のプロファイルは更新可能
CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- 新規ユーザー登録時にプロファイル作成可能
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 2. categories テーブルのRLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 全ユーザーがカテゴリを閲覧可能
CREATE POLICY "Anyone can view categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (true);

-- 管理者のみカテゴリを作成・更新・削除可能
CREATE POLICY "Admins can manage categories"
    ON public.categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 3. pdf_sources テーブルのRLS
ALTER TABLE public.pdf_sources ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーはPDFソースを閲覧可能
CREATE POLICY "Authenticated users can view pdf sources"
    ON public.pdf_sources FOR SELECT
    TO authenticated
    USING (true);

-- 管理者のみPDFをアップロード可能
CREATE POLICY "Admins can upload pdfs"
    ON public.pdf_sources FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者のみPDFを削除可能
CREATE POLICY "Admins can delete pdfs"
    ON public.pdf_sources FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. questions テーブルのRLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは承認済み問題を閲覧可能
CREATE POLICY "Authenticated users can view approved questions"
    ON public.questions FOR SELECT
    TO authenticated
    USING (is_approved = true);

-- 管理者は全ての問題を閲覧可能
CREATE POLICY "Admins can view all questions"
    ON public.questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者のみ問題を作成可能
CREATE POLICY "Admins can create questions"
    ON public.questions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者のみ問題を更新可能
CREATE POLICY "Admins can update questions"
    ON public.questions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者のみ問題を削除可能
CREATE POLICY "Admins can delete questions"
    ON public.questions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. exam_sessions テーブルのRLS
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の試験セッションを閲覧可能
CREATE POLICY "Users can view own exam sessions"
    ON public.exam_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- 管理者は全ての試験セッションを閲覧可能
CREATE POLICY "Admins can view all exam sessions"
    ON public.exam_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ユーザーは自分の試験セッションを作成可能
CREATE POLICY "Users can create own exam sessions"
    ON public.exam_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の試験セッションを更新可能
CREATE POLICY "Users can update own exam sessions"
    ON public.exam_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- 6. exam_answers テーブルのRLS
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の回答を閲覧可能
CREATE POLICY "Users can view own exam answers"
    ON public.exam_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.exam_sessions
            WHERE id = exam_answers.exam_session_id
            AND user_id = auth.uid()
        )
    );

-- 管理者は全ての回答を閲覧可能
CREATE POLICY "Admins can view all exam answers"
    ON public.exam_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ユーザーは自分の試験セッションに回答を追加可能
CREATE POLICY "Users can insert own exam answers"
    ON public.exam_answers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_sessions
            WHERE id = exam_answers.exam_session_id
            AND user_id = auth.uid()
        )
    );

-- 7. exam_settings テーブルのRLS
ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが試験設定を閲覧可能
CREATE POLICY "Anyone can view exam settings"
    ON public.exam_settings FOR SELECT
    TO authenticated
    USING (true);

-- 管理者のみ試験設定を更新可能
CREATE POLICY "Admins can update exam settings"
    ON public.exam_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 8. ai_generation_logs テーブルのRLS
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- 管理者のみAI生成ログを閲覧可能
CREATE POLICY "Admins can view ai generation logs"
    ON public.ai_generation_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理者のみAI生成ログを作成可能
CREATE POLICY "Admins can create ai generation logs"
    ON public.ai_generation_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- トリガー関数: updated_atを自動更新
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.exam_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
