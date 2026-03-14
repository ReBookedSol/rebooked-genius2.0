import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let payload: any = null;

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

    payload = await req.json();
    const { lessonId, knowledgeBaseId, userId, questionCount, questionTypes } = payload;

    const { data: lessonData, error: lessonError } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('id', lessonId)
      .eq('user_id', userId)
      .single();

    if (lessonError || !lessonData) throw new Error(`Failed to fetch lesson: ${lessonError?.message}`);

    let lessonContent = '';
    try {
      const contentData = JSON.parse(lessonData.content);
      lessonContent = contentData.lesson || contentData.content || lessonData.content;
    } catch {
      lessonContent = lessonData.content;
    }

    const filteredTypes = questionTypes.filter((t: string) => t !== 'shortAnswer');
    const typeDescs = filteredTypes.map((t: string) => {
      switch (t) {
        case 'multipleChoice': return 'Multiple choice with 4 options';
        case 'fillInBlank': return 'Fill-in-the-blank with a single word or short phrase, use correct_answers array for accepted variations';
        case 'stringForce': return 'Fill-in-the-blank with correct_answers array';
        case 'trueFalse': return 'True/False';
        case 'dropdown': return 'Sentence with dropdown options';
        case 'matching': return 'Match items using matchingPairs';
        default: return t;
      }
    }).join(', ');

    const systemPrompt = `Generate ${questionCount} test questions. Types: ${typeDescs}.
Return JSON: { "questions": [{ "id", "type", "text", "options", "answer", "correct_answers", "matchingPairs", "explanation" }] }
Return ONLY JSON.`;

    const result = await callGeminiWithFallback(systemPrompt, `Generate from:\n\n${lessonContent}`, { temperature: 0.7 });
    const testData = parseJsonResponse(result.content);

    testData.totalQuestions = testData.questions?.length || questionCount;
    testData.generatedAt = new Date().toISOString();
    testData.lessonId = lessonId;
    testData.questionTypes = questionTypes;
    testData.status = 'completed';

    await supabase
      .from('knowledge_base')
      .update({ content: JSON.stringify(testData), tags: ['generated', 'test', 'completed'], is_active: true })
      .eq('id', knowledgeBaseId)
      .eq('user_id', userId);

    return new Response(JSON.stringify({ success: true, knowledgeBaseId, questionCount: testData.totalQuestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating test:', error);
    if (payload) {
      try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await supabase.from('knowledge_base').update({ tags: ['failed', 'test'], is_active: false }).eq('id', payload.knowledgeBaseId).eq('user_id', payload.userId);
      } catch {}
    }
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
