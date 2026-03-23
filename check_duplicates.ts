import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkDuplicates() {
  const { data: quizzes, error } = await supabase.from('quizzes').select('id, title, created_at').order('created_at', { ascending: false })
  if (error) {
    console.error(error)
    return
  }

  console.log(`Total quizzes: ${quizzes.length}`)
  const groups = {}
  quizzes.forEach(q => {
    const key = `${q.title}_${q.created_at}`
    if (!groups[key]) groups[key] = []
    groups[key].push(q.id)
  })

  Object.entries(groups).forEach(([key, ids]) => {
    if (ids.length > 1) {
      console.log(`Duplicate found: ${key} (IDs: ${ids.join(', ')})`)
    }
  })
}

checkDuplicates()
