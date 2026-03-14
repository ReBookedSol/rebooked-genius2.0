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

    const { content, count = 10, language = 'en' } = await req.json();

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isAfrikaans = language === 'af';

    const systemPrompt = isAfrikaans
      ? `Jy is 'n kundige opvoeder. Genereer meerkeuse-toetsvrae vanuit die verskafde inhoud.
Elke vraag moet 4 opsies met een korrekte antwoord hê.
Gee SLEGS 'n geldige JSON-skikking van vraag-objekte met hierdie eienskappe:
- "question": die vraagteks
- "options": skikking van 4 opsie-stringe
- "correct_answer": die korrekte opsie (moet presies ooreenstem met een van die opsies)
- "explanation": kort verklaring van waarom dit korrek is
Moenie enige ander teks of markdown insluit nie, net die JSON-skikking.`
      : `You are an expert educator. Generate multiple choice quiz questions from the provided content.
Each question should have 4 options with one correct answer.
Return ONLY a valid JSON array of question objects with these properties:
- "question": the question text
- "options": array of 4 option strings
- "correct_answer": the correct option (must match one of the options exactly)
- "explanation": brief explanation of why this is correct
Do not include any other text or markdown, just the JSON array.`;

    const userPrompt = isAfrikaans
      ? `Genereer ${count} toetsvrae vanuit hierdie inhoud:\n\n${content.substring(0, 15000)}`
      : `Generate ${count} quiz questions from this content:\n\n${content.substring(0, 15000)}`;

    console.log(`[generate-quizzes] Generating ${count} quiz questions`);
    const result = await callGeminiWithFallback(systemPrompt, userPrompt, { temperature: 0.5 });
    const questions = parseJsonResponse(result.content);

    return new Response(JSON.stringify({ data: questions, model: result.model }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-quizzes:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
