import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExamView from './ExamView'

export default async function ExamPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const sessionId = parseInt(params.sessionId)

  // セッション情報を取得
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    redirect('/dashboard')
  }

  // すでに終了している場合は結果画面へ
  if (session.end_time) {
    redirect(`/exam/${sessionId}/result`)
  }

  // 試験の回答状況を取得
  const { data: answers } = await supabase
    .from('exam_answers')
    .select(`
      *,
      questions (
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        categories (
          name
        )
      )
    `)
    .eq('exam_session_id', sessionId)
    .order('id')

  if (!answers || answers.length === 0) {
    redirect('/dashboard')
  }

  return (
    <ExamView
      sessionId={sessionId}
      totalQuestions={session.total_questions}
      answers={answers}
    />
  )
}
