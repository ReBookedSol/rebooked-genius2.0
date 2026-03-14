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

    const { content, count = 10, language = 'en', documentId, subjectId } = await req.json();

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isAfrikaans = language === 'af';

    const systemPrompt = isAfrikaans
      ? `Jy is 'n kundige opvoeder. Genereer flitskaarte vanuit die verskafde inhoud.
Elke flitskaart moet 'n duidelike vraag (voor) en 'n bondige antwoord (agter) hê.
Gee SLEGS 'n geldige JSON-skikking van flitskaart-objekte met "front" en "back" eienskappe.
Moenie enige ander teks of markdown insluit nie, net die JSON-skikking.`
      : `You are an expert educator. Generate flashcards from the provided content.
Each flashcard should have a clear question (front) and a concise answer (back).
Return ONLY a valid JSON array of flashcard objects with "front" and "back" properties.
Do not include any other text or markdown, just the JSON array.`;

    const userPrompt = isAfrikaans
      ? `Genereer ${count} flitskaarte vanuit hierdie inhoud:\n\n${content.substring(0, 15000)}`
      : `Generate ${count} flashcards from this content:\n\n${content.substring(0, 15000)}`;

    console.log(`[generate-flashcards] Generating ${count} flashcards`);
    const result = await callGeminiWithFallback(systemPrompt, userPrompt, { temperature: 0.5 });
    const flashcards = parseJsonResponse(result.content);

    return new Response(JSON.stringify({ data: flashcards, model: result.model }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-flashcards:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
