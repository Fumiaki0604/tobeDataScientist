-- データサイエンティスト試験対策アプリ データベーススキーマ

-- 1. ユーザープロファイル拡張テーブル
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. カテゴリテーブル
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PDF元データテーブル
CREATE TABLE IF NOT EXISTS public.pdf_sources (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT
);

-- 4. 問題テーブル
CREATE TABLE IF NOT EXISTS public.questions (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
    explanation TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_generated', 'pdf_imported')),
    source_pdf_id INTEGER REFERENCES public.pdf_sources(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 試験セッションテーブル
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    score_percentage DECIMAL(5,2),
    passed BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 試験回答テーブル
CREATE TABLE IF NOT EXISTS public.exam_answers (
    id SERIAL PRIMARY KEY,
    exam_session_id INTEGER NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    user_answer TEXT NOT NULL CHECK (user_answer IN ('a', 'b', 'c', 'd')),
    is_correct BOOLEAN NOT NULL,
    time_spent INTEGER, -- 秒単位
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 試験設定テーブル
CREATE TABLE IF NOT EXISTS public.exam_settings (
    id SERIAL PRIMARY KEY,
    total_questions INTEGER NOT NULL DEFAULT 20,
    passing_score DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    time_limit_minutes INTEGER, -- NULL = 無制限
    category_weights JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 8. AI生成ログテーブル
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
    id SERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    generated_question_id INTEGER REFERENCES public.questions(id) ON DELETE SET NULL,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_approved ON public.questions(is_approved);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON public.exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_session ON public.exam_answers(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_question ON public.exam_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- デフォルトの試験設定を挿入
INSERT INTO public.exam_settings (total_questions, passing_score, time_limit_minutes)
VALUES (20, 70.00, NULL)
ON CONFLICT DO NOTHING;

-- カテゴリの初期データ投入
INSERT INTO public.categories (name, parent_id, display_order, description) VALUES
-- 大カテゴリ
('データサイエンス力', NULL, 1, 'データサイエンスに関する知識とスキル'),
('データエンジニアリング力', NULL, 2, 'データエンジニアリングに関する知識とスキル'),
('ビジネス力', NULL, 3, 'ビジネスに関する知識とスキル'),
('リテラシーレベル', NULL, 4, 'データサイエンティスト検定リテラシーレベルの試験範囲')
ON CONFLICT DO NOTHING;

-- データサイエンス力のサブカテゴリ
INSERT INTO public.categories (name, parent_id, display_order) VALUES
('線形代数基礎', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 1),
('微分・積分基礎', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 2),
('集合論基礎', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 3),
('統計数理基礎', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 4),
('推定・検定', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 5),
('機械学習', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 6),
('深層学習', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 7),
('時系列分析', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 8),
('自然言語処理', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 9),
('大規模言語モデル', (SELECT id FROM public.categories WHERE name = 'データサイエンス力'), 10)
ON CONFLICT DO NOTHING;

-- データエンジニアリング力のサブカテゴリ
INSERT INTO public.categories (name, parent_id, display_order) VALUES
('システム設計', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 1),
('データ収集', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 2),
('データ構造', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 3),
('クラウド技術', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 4),
('SQL', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 5),
('プログラミング', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 6),
('ITセキュリティ', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 7),
('MLOps', (SELECT id FROM public.categories WHERE name = 'データエンジニアリング力'), 8)
ON CONFLICT DO NOTHING;

-- ビジネス力のサブカテゴリ
INSERT INTO public.categories (name, parent_id, display_order) VALUES
('ビジネスマインド', (SELECT id FROM public.categories WHERE name = 'ビジネス力'), 1),
('データ・AI倫理', (SELECT id FROM public.categories WHERE name = 'ビジネス力'), 2),
('コンプライアンス', (SELECT id FROM public.categories WHERE name = 'ビジネス力'), 3),
('プロジェクトマネジメント', (SELECT id FROM public.categories WHERE name = 'ビジネス力'), 4)
ON CONFLICT DO NOTHING;

-- リテラシーレベルのサブカテゴリ
INSERT INTO public.categories (name, parent_id, display_order) VALUES
('社会におけるデータ・AI利活用', (SELECT id FROM public.categories WHERE name = 'リテラシーレベル'), 1),
('データリテラシー', (SELECT id FROM public.categories WHERE name = 'リテラシーレベル'), 2),
('データ・AI利活用における留意事項', (SELECT id FROM public.categories WHERE name = 'リテラシーレベル'), 3)
ON CONFLICT DO NOTHING;
