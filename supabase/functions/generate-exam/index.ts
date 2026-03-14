import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { content, questionCount = 20, title = 'Exam', questionTypes } = await req.json();
    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const enabledTypes = questionTypes || ['multipleChoice', 'fillInBlank', 'multipleAnswer'];

    const systemPrompt = `You are an expert exam creator. Generate exactly ${questionCount} questions.

Return ONLY a valid JSON object:
{
  "questions": [...],
  "totalPoints": number,
  "estimatedMinutes": number
}

Question types:
${enabledTypes.includes('multipleChoice') ? '- multipleChoice: 4 options, 1 correct. Use "correct_answer".' : ''}
${enabledTypes.includes('fillInBlank') ? '- fillInBlank: Use "correct_answers" array.' : ''}
${enabledTypes.includes('multipleAnswer') ? '- multipleAnswer: 4-5 options, 2-3 correct. Use "correct_answers" array.' : ''}
${enabledTypes.includes('trueFalse') ? '- trueFalse: Use "correct_answer": "True" or "False".' : ''}
${enabledTypes.includes('dropdown') ? '- dropdown: Use "options" and "correct_answer".' : ''}
${enabledTypes.includes('matching') ? '- matching: Use "matchingPairs": [{"left":"...","right":"..."}]' : ''}

Each question: id, question, question_type, options, correct_answer, correct_answers, matchingPairs, explanation, points (1-5), difficulty.
Make it progressively harder.`;

    const userPrompt = `Generate ${questionCount}-question exam:\n\n${content.substring(0, 15000)}`;

    const result = await callGeminiWithFallback(systemPrompt, userPrompt, { temperature: 0.5 });
    const exam = parseJsonResponse(result.content);

    return new Response(JSON.stringify(exam), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in generate-exam:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
