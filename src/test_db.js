import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cols1 } = await supabase.rpc('get_table_columns_by_name', { table_name: 'nbt_question_collections' });
  console.log("nbt_question_collections:", cols1);
}
check();
