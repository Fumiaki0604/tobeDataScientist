const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://jukqtwbhfgcrgbsihfdu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1a3F0d2JoZmdjcmdic2loZmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTAxODcsImV4cCI6MjA3ODc4NjE4N30.SlOdFUQjTC8LzxdFumJ-AmoJD7w5cwA7Us_43Abksh0'
)

async function checkQuestions() {
  const { data, error, count } = await supabase
    .from('questions')
    .select('id, question_text, source, is_approved, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`\n総問題数: ${count}問\n`)
  console.log('最新の10問:')
  data.forEach((q, i) => {
    console.log(`\n${i + 1}. ID: ${q.id}`)
    console.log(`   問題文: ${q.question_text.substring(0, 50)}...`)
    console.log(`   ソース: ${q.source}`)
    console.log(`   承認: ${q.is_approved ? '済' : '未'}`)
    console.log(`   作成日: ${new Date(q.created_at).toLocaleString('ja-JP')}`)
  })
}

checkQuestions()
