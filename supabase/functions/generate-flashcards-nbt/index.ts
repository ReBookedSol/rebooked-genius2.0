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
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim().replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
      if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
      cleaned += ']';
      return JSON.parse(cleaned);
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

    const { lessonContent, section, materialId, nbtLessonId, flashcardCount, selectedTopics } = await req.json();
    if (!lessonContent) throw new Error('Missing or empty lesson content');

    const count = flashcardCount || 15;
    const topicHint = selectedTopics?.length ? `Focus specifically on these topics: ${selectedTopics.join(', ')}.` : '';
    console.log(`[generate-flashcards-nbt] Generating ${count} flashcards for section: ${section}, lessonId: ${nbtLessonId}`);

    const systemPrompt = `Generate a set of ${count} high-quality flashcards for active recall on NBT ${section} topics based on the following lesson content.
${topicHint}
Each flashcard should have a clear question (front) and a concise, informative answer (back).
Return the response as a JSON array of objects with keys: "front", "back".
ONLY RETURN THE JSON ARRAY. NO MARKDOWN BLOCKS. NO OTHER TEXT.`;

    const result = await callGeminiWithFallback(systemPrompt, lessonContent.substring(0, 15000), { temperature: 0.5 });
    const flashcards = safeParseJsonArray(result.content);

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw new Error('AI returned empty or invalid flashcards');
    }

    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .insert({
        user_id: user.id,
        title: `NBT ${section} Mastery Deck`,
        description: `Active recall cards for the ${section} section.`,
        is_ai_generated: true,
        nbt_lesson_id: nbtLessonId || null,
      })
      .select()
      .single();

    if (deckError) throw deckError;

    const flashcardsToInsert = flashcards.map((f: any) => ({
      user_id: user.id,
      deck_id: deck.id,
      front: f.front,
      back: f.back
    }));

    const { error: flashcardsError } = await supabase.from('flashcards').insert(flashcardsToInsert);
    if (flashcardsError) throw flashcardsError;

    console.log(`[generate-flashcards-nbt] Successfully created deck ${deck.id} with ${flashcardsToInsert.length} flashcards`);

    return new Response(
      JSON.stringify({ success: true, deckId: deck.id, cardCount: flashcardsToInsert.length, message: `Successfully generated flashcards for ${section}.`, model: result.model }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-flashcards-nbt:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
