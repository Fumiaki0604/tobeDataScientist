import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者チェック
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { pdfId, count = 5 } = await request.json()

    if (!pdfId) {
      return NextResponse.json({ error: 'PDFIDが必要です' }, { status: 400 })
    }

    // PDFの情報を取得
    const { data: pdf } = await supabase
      .from('pdf_sources')
      .select('*')
      .eq('id', pdfId)
      .single()

    if (!pdf) {
      return NextResponse.json({ error: 'PDFが見つかりません' }, { status: 404 })
    }

    // カテゴリ一覧を取得
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .order('display_order')

    const categoryList = categories?.map((c) => `${c.id}: ${c.name}`).join('\n') || ''

    // OpenAI APIで問題を生成
    const prompt = `データサイエンティスト検定リテラシーレベルの試験問題を${count}問作成してください。

以下のカテゴリから適切なものを選んでください：
${categoryList}

各問題は以下の形式のJSONで出力してください：
[
  {
    "category_id": カテゴリID（数値）,
    "question_text": "問題文",
    "option_a": "選択肢A",
    "option_b": "選択肢B",
    "option_c": "選択肢C",
    "option_d": "選択肢D",
    "correct_answer": "正解（a/b/c/dのいずれか）",
    "explanation": "解説",
    "difficulty": 難易度（1-5の数値）
  }
]

重要：
- 4択問題にしてください
- 問題は実践的で、データサイエンスの知識を問うものにしてください
- 解説は詳しく、理解しやすいものにしてください
- JSONのみを出力し、他のテキストは含めないでください`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'あなたはデータサイエンティスト検定試験の問題作成の専門家です。適切な難易度と質の高い問題を作成してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const responseText = completion.choices[0].message.content
    if (!responseText) {
      throw new Error('OpenAI APIからの応答がありません')
    }

    // JSONをパース
    let questions
    try {
      questions = JSON.parse(responseText)
    } catch (e) {
      console.error('JSON parse error:', responseText)
      throw new Error('生成された問題のパースに失敗しました')
    }

    // 既存の問題を取得して重複チェック
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('question_text')

    const existingTexts = new Set(
      existingQuestions?.map((q) => q.question_text.toLowerCase().trim()) || []
    )

    // 重複を除外
    const uniqueQuestions = questions.filter((q: any) => {
      const questionText = q.question_text.toLowerCase().trim()
      return !existingTexts.has(questionText)
    })

    if (uniqueQuestions.length === 0) {
      throw new Error('すべての問題が既存の問題と重複しています。もう一度生成してください。')
    }

    if (uniqueQuestions.length < questions.length) {
      console.log(
        `${questions.length - uniqueQuestions.length}問が重複のため除外されました`
      )
    }

    // DBに保存
    const insertData = uniqueQuestions.map((q: any) => ({
      category_id: q.category_id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      source: 'ai_generated',
      is_approved: false, // 最初は未承認
      created_by: user.id,
    }))

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(insertData)
      .select()

    if (insertError) {
      throw insertError
    }

    // ログを記録
    await supabase.from('ai_generation_logs').insert({
      pdf_source_id: pdfId,
      questions_generated: insertedQuestions?.length || 0,
      prompt_used: prompt,
      model_used: 'gpt-4',
      generated_by: user.id,
    })

    return NextResponse.json({
      success: true,
      count: insertedQuestions?.length || 0,
      questions: insertedQuestions,
    })
  } catch (error: any) {
    console.error('Error generating questions:', error)
    return NextResponse.json(
      { error: error.message || '問題生成に失敗しました' },
      { status: 500 }
    )
  }
}
