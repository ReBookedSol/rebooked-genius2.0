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

    const { type, content, count, language = 'en', message, documentContext, tier = 'free' } = await req.json();
    console.log('[ai-generate] Request:', { type, count, language, tier, contentLength: content?.length });

    let systemPrompt = '';
    let userPrompt = '';
    const isAfrikaans = language === 'af';

    if (type === 'chat') {
      systemPrompt = isAfrikaans
        ? `Jy is 'n kundige studiebegeleier en onderwyser. Beantwoord vrae gebaseer op die verskafde dokument.`
        : `You are an expert study guide and educator. Answer questions based on the provided document context. Be specific and practical.`;

      let documentInfo = '';
      if (documentContext) {
        documentInfo = `Document Title: ${documentContext.title}\nSummary: ${documentContext.summary || 'N/A'}\nContent: ${documentContext.content ? documentContext.content.substring(0, 3000) : 'N/A'}`;
      }
      userPrompt = `${documentInfo}\n\nStudent Question: ${message}`;
    } else if (type === 'flashcards') {
      systemPrompt = isAfrikaans
        ? `Genereer flitskaarte. Gee SLEGS 'n JSON-skikking met "front" en "back".`
        : `Generate flashcards. Return ONLY a valid JSON array with "front" and "back" properties.`;
      userPrompt = `Generate ${count || 5} flashcards from:\n\n${content}`;
    } else if (type === 'quiz') {
      systemPrompt = isAfrikaans
        ? `Genereer meerkeuse-toetsvrae. Gee SLEGS 'n JSON-skikking met "question", "options", "correct_answer", "explanation".`
        : `Generate multiple choice quiz questions. Return ONLY a JSON array with "question", "options", "correct_answer", "explanation".`;
      userPrompt = `Generate ${count || 5} quiz questions from:\n\n${content}`;
    } else if (type === 'ingest_paper') {
      systemPrompt = `Extract a structured representation of all questions. Return ONLY a JSON array with "question_number", "question_text", "context", "section", "topic", "marks".`;
      userPrompt = `Analyze this past paper:\n\n${content}`;
    } else if (type === 'summary') {
      systemPrompt = `Create a clear, structured summary using bullet points organized by key concepts.`;
      userPrompt = `Summarize for study:\n\n${content}`;
    } else if (type === 'chat_title') {
      systemPrompt = `Generate a short title (max 6 words). Return ONLY the title.`;
      userPrompt = `Title for:\n\n${message}`;
    } else if (type === 'blurting') {
      systemPrompt = `Analyze a student's spoken explanation against lesson content. Return ONLY a JSON object with: "recalled_concepts", "missing_concepts", "misconceptions" (array of {text, explanation}), "confidence_score" (0-1), "suggested_practice_questions" (array of {q, type}), "study_recommendations".`;
      const lessonContext = documentContext?.content?.substring(0, 2000) || '';
      userPrompt = `Student's explanation: "${content}"\n\nLesson Content:\n${lessonContext}`;
    } else {
      throw new Error('Invalid generation type');
    }

    const result = await callGeminiWithFallback(systemPrompt, userPrompt, { temperature: 0.5 });

    if (type === 'chat') {
      return new Response(JSON.stringify({ response: result.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (type === 'chat_title') {
      return new Response(JSON.stringify({ title: result.content.trim() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (type === 'summary') {
      return new Response(JSON.stringify({ data: result.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (['flashcards', 'quiz', 'blurting', 'ingest_paper'].includes(type)) {
      try {
        const parsed = parseJsonResponse(result.content);
        return new Response(JSON.stringify({ data: parsed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (parseError) {
        console.error('Parse error:', parseError);
        return new Response(JSON.stringify({ error: 'Failed to parse generated content', raw: result.content }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ data: result.content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI generate error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
