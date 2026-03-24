import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAT_EXEMPLAR_STYLE = `The MAT (Mathematics) section tests mathematical proficiency at Grade 12+ level.
Question styles from the official NBT MAT exemplar include:
- Multiple choice with 4 options (A, B, C, D)
- Questions test algebraic manipulation, function analysis, calculus, trigonometry
- Example: "If f(x) = 2x² - 3x + 1, then f(a+1) - f(a) equals..." with precise numerical options
- Data interpretation from tables, graphs, and charts
- Geometric reasoning with diagrams described in text
- Pattern recognition and sequences
- Financial mathematics with real-world scenarios
Questions should be rigorous, testing deep understanding not just rote memorization.`;

const AQL_EXEMPLAR_STYLE = `The AQL (Academic and Quantitative Literacy) section tests reading comprehension and numerical reasoning.
Question styles from the official NBT AQL exemplar include:
- Reading comprehension passages followed by inference questions
- Vocabulary in context: "The word 'ubiquitous' in paragraph 3 most likely means..."
- Grammar and sentence correction questions
- Data interpretation: reading tables, pie charts, bar graphs
- Quantitative reasoning: percentages, ratios, proportions in real-world contexts
- Financial literacy: VAT calculations, interest rates, budgets
- Critical reasoning: identifying assumptions, evaluating arguments
- Probability questions using everyday scenarios
Questions should mirror actual NBT exam format with academic-level passages.`;

function safeParseQuestions(raw: string): any[] {
  try {
    return parseJsonResponse(raw);
  } catch (_e) {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    cleaned = cleaned.trim().replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1);
      if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
      cleaned += ']';
      const result = JSON.parse(cleaned);
      console.log(`[generate-exam-nbt-practice] Recovered ${result.length} questions from truncated JSON`);
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

    const { section, testId, questionCount, difficulty, selectedTopics } = await req.json();

    // Allow full tests to reach 50 questions, but split into smaller parallel batches
    // so generation finishes faster and is less likely to truncate.
    const requestedCount = Math.min(questionCount || 50, 50);
    const batchSize = 25;
    const totalBatches = Math.ceil(requestedCount / batchSize);
    const diff = difficulty || 'mixed';
    const topicHint = selectedTopics?.length ? `Focus specifically on these topics: ${selectedTopics.join(', ')}.` : '';
    const uniqueSeed = `Unique seed: ${crypto.randomUUID()} | Timestamp: ${new Date().toISOString()}`;

    console.log(`[generate-exam-nbt-practice] Generating ${requestedCount} ${diff} questions for section: ${section}, testId: ${testId || 'none'}`);

    const exemplarStyle = section === 'MAT' ? MAT_EXEMPLAR_STYLE : AQL_EXEMPLAR_STYLE;

    const topicList = selectedTopics?.length ? selectedTopics : (
      section === 'MAT'
        ? ['Functions and Graphs', 'Algebraic Processes', 'Number Sense', 'Trigonometry', 'Calculus', 'Sequences & Series', 'Transformations', 'Spatial Awareness', 'Data Handling & Probability', 'Financial Mathematics']
        : ['Comprehension', 'Vocabulary in context', 'Grammar & Syntax', 'Inferencing', 'Critical Reasoning', 'Data Interpretation', 'Percentages & Ratios', 'Tables & Charts', 'Probability', 'Financial Calculations']
    );

    const batchPromises = Array.from({ length: totalBatches }, (_, batchIndex) => {
      const batchCount = Math.min(batchSize, requestedCount - batchIndex * batchSize);
      const batchSeed = `${uniqueSeed} | Batch: ${batchIndex + 1}/${totalBatches}`;

      const systemPrompt = `You are an expert NBT (National Benchmark Test) question writer for South African university admissions.

${exemplarStyle}

${topicHint}

Generate EXACTLY ${batchCount} UNIQUE, high-quality practice questions for the NBT ${section} section.
Spread questions evenly across these topics: ${topicList.join(', ')}.

CRITICAL REQUIREMENTS:
- Match the EXACT style and difficulty of official NBT exemplar papers
- Each question must be completely different in topic and approach
- Difficulty distribution: ${diff === 'mixed' ? '30% easy, 50% medium, 20% hard' : `mostly ${diff}`}
- All options must be plausible - no obviously wrong answers
- Explanations must show step-by-step reasoning
- ${batchSeed}

Return ONLY a valid JSON array with these keys per object:
- "title": short topic label
- "question_text": full question text
- "options": array of exactly 4 strings
- "correct_answer": string matching one option exactly
- "explanation": detailed step-by-step solution
- "difficulty": "easy", "medium", or "hard"

NO markdown. NO code blocks. ONLY the JSON array.`;

      return callGeminiWithFallback(systemPrompt, `NBT ${section} practice test generation. Topics: ${topicList.join(', ')}`, {
        temperature: 0.75,
        maxOutputTokens: Math.min(22000, 5000 + batchCount * 600),
        jsonMode: true,
      }).then((result) => {
        const questions = safeParseQuestions(result.content);
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('AI returned empty questions array');
        }
        return {
          questions: questions.slice(0, batchCount),
          model: result.model,
          tokens: result.inputTokens + result.outputTokens,
        };
      });
    });

    const batchResults = await Promise.all(batchPromises);
    const allQuestions = batchResults.flatMap((batch) => batch.questions);
    const totalTokens = batchResults.reduce((sum, batch) => sum + batch.tokens, 0);

    if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
      throw new Error('AI returned empty questions array');
    }

    console.log(`[generate-exam-nbt-practice] Generated ${allQuestions.length} questions`);

    // Insert questions
    const questionsToInsert = allQuestions.map((q: any) => ({
      user_id: user.id,
      section: section,
      title: q.title || `NBT ${section} Question`,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty || 'medium',
      question_type: 'multiple_choice',
      is_official: false,
      is_published: true,
    }));

    const { data: savedQuestions, error: questionsError } = await supabase
      .from('nbt_practice_questions')
      .insert(questionsToInsert)
      .select('id');

    if (questionsError) throw questionsError;

    // Link to test
    if (testId && savedQuestions && savedQuestions.length > 0) {
      await supabase.from('nbt_test_questions').delete().eq('test_id', testId);

      const testQuestionLinks = savedQuestions.map((q: any, index: number) => ({
        test_id: testId,
        question_id: q.id,
        order_index: index,
      }));

      const { error: linkError } = await supabase.from('nbt_test_questions').insert(testQuestionLinks);
      if (linkError) throw linkError;

      await supabase
        .from('nbt_practice_tests')
        .update({ total_questions: savedQuestions.length, is_published: true })
        .eq('id', testId);

      console.log(`[generate-exam-nbt-practice] Linked ${savedQuestions.length} questions to test ${testId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        testId: testId || null,
        questionCount: savedQuestions?.length || allQuestions.length,
        message: `Successfully generated ${savedQuestions?.length} NBT ${section} practice questions.`,
        model: batchResults[0]?.model || 'unknown',
        usage: { total: totalTokens },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-exam-nbt-practice] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
