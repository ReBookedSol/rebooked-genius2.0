import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function safeParseJsonArray(raw: string): any[] {
  try {
    return parseJsonResponse(raw);
  } catch (_e) {
    // Try to recover truncated JSON
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    
    // Strip control characters (keep newlines and tabs)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    cleaned = cleaned.trim();

    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // Find last complete object
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
      if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
      cleaned += ']';
      const result = JSON.parse(cleaned);
      console.log(`[generate-quiz-nbt] Recovered ${result.length} questions from truncated JSON`);
      return result;
    }
    throw new Error('Cannot recover JSON');
  }
}

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

    const { lessonContent, section, materialId, nbtLessonId } = await req.json();
    if (!lessonContent) throw new Error('Missing or empty lesson content');

    console.log(`[generate-quiz-nbt] Generating quiz for section: ${section}, lessonId: ${nbtLessonId}`);

    const systemPrompt = `Generate a set of 10 high-quality practice questions for the NBT ${section} section based on the following lesson content.

For each question, provide:
1. The question text.
2. 4 Multiple choice options (A, B, C, D).
3. The correct answer (must exactly match one of the options).
4. A detailed step-by-step solution/explanation.

Return the response as a JSON array of objects with keys: title, question_text, options (array of 4 strings), correct_answer, explanation, difficulty (easy/medium/hard).

ONLY RETURN THE JSON ARRAY. NO MARKDOWN BLOCKS. NO OTHER TEXT.`;

    const result = await callGeminiWithFallback(systemPrompt, lessonContent.substring(0, 15000), { temperature: 0.5 });
    const questions = safeParseJsonArray(result.content);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI returned empty or invalid questions');
    }

    const { data: collection, error: collectionError } = await supabase
      .from('nbt_question_collections')
      .insert({
        user_id: user.id,
        title: `Quiz: NBT ${section} Mastery`,
        section: section,
        topic: 'Mastery',
        is_official: true,
        is_published: true,
        difficulty: 'mixed',
        nbt_lesson_id: nbtLessonId || null,
      })
      .select()
      .single();

    if (collectionError) throw collectionError;

    const questionsToInsert = questions.map((q: any) => ({
      user_id: user.id,
      collection_id: collection.id,
      section: section,
      title: q.title || `NBT ${section} Practice Question`,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty || 'medium',
      question_type: 'multiple_choice',
      is_official: true,
      is_published: true
    }));

    const { error: questionsError } = await supabase.from('nbt_practice_questions').insert(questionsToInsert);
    if (questionsError) throw questionsError;

    console.log(`[generate-quiz-nbt] Successfully created collection ${collection.id} with ${questionsToInsert.length} questions`);

    return new Response(
      JSON.stringify({ success: true, collectionId: collection.id, questionCount: questionsToInsert.length, message: `Successfully generated a quiz for ${section}.`, model: result.model }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-quiz-nbt:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
