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
      return new Response(JSON.stringify({ error: 'Content is required to generate an exam' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const enabledTypes = (questionTypes || ['multipleChoice', 'fillInBlank', 'multipleAnswer']).filter((t: string) => t !== 'shortAnswer');

    const systemPrompt = `You are an expert exam creator. Generate a comprehensive exam with exactly ${questionCount} questions from the provided content.

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "questions": [...],
  "totalPoints": number,
  "estimatedMinutes": number
}

Question types to include (mix them):
${enabledTypes.includes('multipleChoice') ? '- multipleChoice: 4 options, exactly 1 correct answer. Use "correct_answer" field.' : ''}
${enabledTypes.includes('fillInBlank') ? '- fillInBlank: Student types the answer. Use "correct_answers" array for accepted variations.' : ''}
${enabledTypes.includes('multipleAnswer') ? '- multipleAnswer: 4-5 options, 2-3 correct answers. Use "correct_answers" array.' : ''}
${enabledTypes.includes('trueFalse') ? '- trueFalse: A statement that is either True or False. Use "correct_answer": "True" or "False".' : ''}
${enabledTypes.includes('dropdown') ? '- dropdown: A sentence with a missing part selected from 3-4 options. Use "options" and "correct_answer".' : ''}
${enabledTypes.includes('matching') ? '- matching: Match items from Column A to Column B. Use "matchingPairs": [{"left": "...", "right": "..."}]' : ''}

Each question object must have:
- "id": number (sequential)
- "question": string
- "question_type": one of the types above
- "options": array of strings (for multipleChoice, multipleAnswer, dropdown)
- "correct_answer": string (for single-answer types)
- "correct_answers": array of strings (for multipleAnswer and fillInBlank)
- "matchingPairs": array of {"left": string, "right": string} (for matching type only)
- "explanation": string
- "points": number (1-5 based on difficulty)
- "difficulty": "easy" | "medium" | "hard"

Make the exam progressively harder.`;

    const userPrompt = `Generate a ${questionCount}-question exam from this content:\n\n${content.substring(0, 15000)}`;

    console.log(`[generate-exams] Generating ${questionCount}-question exam`);
    const result = await callGeminiWithFallback(systemPrompt, userPrompt, { temperature: 0.5 });
    const exam = parseJsonResponse(result.content);

    return new Response(JSON.stringify(exam), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-exams:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
