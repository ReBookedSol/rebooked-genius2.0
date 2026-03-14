import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback } from "../_shared/gemini-fallback.ts";

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

    const { documentText, section } = await req.json();
    if (!documentText || !documentText.trim()) throw new Error('Missing or empty document text');

    console.log(`[nbt/generate-lesson] Generating lesson for section: ${section}`);

    // Step 1: Analyze
    const analysisPrompt = `You are an expert NBT content analyzer. Analyze the provided text for the ${section} section.
FOCUS ONLY on factual content, question styles, core patterns, and specific terminology.
Extract: 1. Key patterns 2. Main topics 3. Specific terminology 4. Difficulty level and common traps.
Output a structured outline.`;

    const analysis = await callGeminiWithFallback(analysisPrompt, `SOURCE TEXT:\n${documentText}`, { temperature: 0.4 });

    // Step 2: Generate lesson
    const lessonPrompt = `You are an elite expert NBT tutor. Generate a comprehensive, well-structured lesson in Markdown format for the NBT ${section} section.

LEARNED CONTEXT:
${analysis.content}

FORMATTING: # title, ## sections, ### subsections, **bold** key terms, > pro tips, --- separators

CONTENT: Start with learning objectives, explain concepts clearly, give your own examples, give strategies, end with a summary.`;

    const lessonResult = await callGeminiWithFallback(lessonPrompt, documentText, { temperature: 0.4, usePro: true });

    // Step 3: Generate questions
    const questionsPrompt = `Generate 10 multiple-choice questions for NBT ${section}.

LEARNED CONTEXT:
${analysis.content}

For each question return: title, question_text, options (A–D), correct_answer, explanation, difficulty (easy|medium|hard).
ONLY return a JSON array.`;

    const questionsResult = await callGeminiWithFallback(questionsPrompt, documentText, { temperature: 0.5, usePro: true });

    let questions;
    try {
      const cleanJson = questionsResult.content.replace(/```json|```/g, '').trim();
      questions = JSON.parse(cleanJson);
    } catch {
      throw new Error('Failed to parse generated questions JSON');
    }

    // Save material
    const { data: material, error: materialError } = await supabase
      .from('nbt_study_materials')
      .insert({
        user_id: user.id,
        section,
        title: `Comprehensive NBT ${section} Mastery Lesson`,
        content: lessonResult.content,
        material_type: 'notes',
        topic: 'Mastery',
        is_official: true,
        is_published: true,
      })
      .select()
      .single();

    if (materialError) throw materialError;

    // Save questions collection
    const { data: collection, error: collectionError } = await supabase
      .from('nbt_question_collections')
      .insert({
        user_id: user.id,
        title: `Quiz: NBT ${section} Mastery`,
        section,
        topic: 'Mastery',
        is_official: true,
        is_published: true,
        difficulty: 'mixed',
      })
      .select()
      .single();

    if (collectionError) throw collectionError;

    const questionsToInsert = questions.map((q: any) => ({
      user_id: user.id,
      collection_id: collection.id,
      section,
      title: q.title || `NBT ${section} Practice Question`,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty || 'medium',
      question_type: 'multiple_choice',
      is_official: true,
      is_published: true,
    }));

    const { error: questionsError } = await supabase.from('nbt_practice_questions').insert(questionsToInsert);
    if (questionsError) throw questionsError;

    return new Response(
      JSON.stringify({ success: true, materialId: material.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in nbt/generate-lesson:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
