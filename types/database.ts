export type UserRole = 'user' | 'admin'

export type QuestionSource = 'manual' | 'ai_generated' | 'pdf_imported'

export type AnswerOption = 'a' | 'b' | 'c' | 'd'

export interface UserProfile {
  id: string
  role: UserRole
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
  display_order: number
  description: string | null
  created_at: string
}

export interface PdfSource {
  id: number
  filename: string
  file_url: string
  upload_date: string
  uploaded_by: string | null
  description: string | null
}

export interface Question {
  id: number
  category_id: number | null
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: AnswerOption
  explanation: string | null
  difficulty: number
  source: QuestionSource
  source_pdf_id: number | null
  is_approved: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ExamSession {
  id: number
  user_id: string
  start_time: string
  end_time: string | null
  total_questions: number
  correct_answers: number
  score_percentage: number | null
  passed: boolean | null
  created_at: string
}

export interface ExamAnswer {
  id: number
  exam_session_id: number
  question_id: number
  user_answer: AnswerOption
  is_correct: boolean
  time_spent: number | null
  created_at: string
}

export interface ExamSettings {
  id: number
  total_questions: number
  passing_score: number
  time_limit_minutes: number | null
  category_weights: Record<string, number>
  updated_at: string
  updated_by: string | null
}

export interface AiGenerationLog {
  id: number
  prompt: string
  model: string
  generated_question_id: number | null
  response_data: Record<string, any> | null
  created_at: string
  created_by: string | null
}

// リレーション付きの型
export interface QuestionWithCategory extends Question {
  category: Category | null
}

export interface ExamSessionWithAnswers extends ExamSession {
  exam_answers: ExamAnswer[]
}

export interface ExamAnswerWithQuestion extends ExamAnswer {
  question: Question
}
