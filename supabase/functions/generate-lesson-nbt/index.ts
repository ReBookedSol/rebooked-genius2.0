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

    const { documentText, section, documentId } = await req.json();
    if (!documentText || !documentText.trim()) throw new Error('Missing or empty document text');

    console.log(`[generate-lesson-nbt] Generating lesson for section: ${section}, documentId: ${documentId}`);

    // Check if a lesson already exists for this document
    if (documentId) {
      const { data: existingLesson } = await supabase
        .from('nbt_generated_lessons')
        .select('id, content, title')
        .eq('user_id', user.id)
        .eq('source_document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingLesson) {
        console.log(`[generate-lesson-nbt] Found existing lesson ${existingLesson.id} for document ${documentId}`);
        return new Response(
          JSON.stringify({ success: true, lessonId: existingLesson.id, materialId: null, alreadyExists: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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

    // Save to nbt_generated_lessons table (primary persistence)
    const { data: generatedLesson, error: generatedLessonError } = await supabase
      .from('nbt_generated_lessons')
      .insert({
        user_id: user.id,
        source_document_id: documentId || null,
        section,
        title: `Comprehensive NBT ${section} Mastery Lesson`,
        content: lessonResult.content,
      })
      .select()
      .single();

    if (generatedLessonError) throw generatedLessonError;

    // Also save to nbt_study_materials for backward compatibility
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
        source_document_id: documentId || null,
      })
      .select()
      .single();

    if (materialError) {
      console.error('Error saving to nbt_study_materials:', materialError);
    }

    // Update the source_material_id on the generated lesson
    if (material) {
      await supabase
        .from('nbt_generated_lessons')
        .update({ source_material_id: material.id })
        .eq('id', generatedLesson.id);
    }

    // Update nbt_user_documents to mark as processed
    if (documentId) {
      await supabase
        .from('nbt_user_documents')
        .update({
          processed_content: lessonResult.content,
          extraction_status: 'completed'
        })
        .eq('id', documentId)
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lessonId: generatedLesson.id, 
        materialId: material?.id || null,
        alreadyExists: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-lesson-nbt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
