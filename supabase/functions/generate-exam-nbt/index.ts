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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { lessonContent, section, nbtLessonId, questionCount, difficulty, selectedTopics, testId } = await req.json();

    // Cap question count to avoid token overflow; generate in batches if needed
    const requestedCount = questionCount || 50;
    const count = Math.min(requestedCount, 25); // Generate max 25 at a time to avoid truncation
    const diff = difficulty || 'medium';
    const topicHint = selectedTopics?.length ? `Focus specifically on these topics: ${selectedTopics.join(', ')}.` : '';
    const uniqueSeed = `Unique seed: ${crypto.randomUUID()} | Timestamp: ${new Date().toISOString()}`;

    console.log(`[generate-exam-nbt] Generating ${count} ${diff} questions for section: ${section}, testId: ${testId || 'none'}, requested: ${requestedCount}`);

    // Build content for the AI
    let contentForAI = '';
    if (lessonContent && lessonContent.length > 50) {
      contentForAI = lessonContent;
    } else {
      if (section === 'MAT') {
        const matTopics = selectedTopics?.length ? selectedTopics : [
          'Functions and Graphs', 'Algebraic Processes', 'Number Sense',
          'Trigonometry', 'Calculus', 'Sequences & Series', 'Transformations',
          'Spatial Awareness', 'Data Handling & Probability', 'Financial Mathematics'
        ];
        contentForAI = `NBT Mathematics (MAT) Section. Topics to cover: ${matTopics.join(', ')}. 
The MAT tests mathematical proficiency at a Grade 12+ level. Questions should test:
- Algebraic manipulation and problem solving
- Understanding of functions (linear, quadratic, exponential, logarithmic, trigonometric)
- Calculus concepts (derivatives, integrals, rates of change)
- Geometric reasoning and spatial visualization
- Data interpretation and probability
- Number patterns and sequences
Generate questions that mirror the style and difficulty of actual NBT MAT papers.`;
      } else {
        const aqlTopics = selectedTopics?.length ? selectedTopics : [
          'Comprehension', 'Vocabulary in context', 'Grammar & Syntax',
          'Inferencing', 'Critical Reasoning', 'Data Interpretation',
          'Percentages & Ratios', 'Tables & Charts', 'Probability', 'Financial Calculations'
        ];
        contentForAI = `NBT Academic and Quantitative Literacy (AQL) Section. Topics to cover: ${aqlTopics.join(', ')}.
The AQL tests academic literacy (reading comprehension, language use) and quantitative literacy (working with numbers in real-world contexts). Questions should test:
- Reading comprehension of academic texts
- Understanding vocabulary in context
- Grammar, syntax, and sentence structure
- Making inferences and evaluating arguments
- Interpreting data from tables, charts, and graphs
- Working with percentages, ratios, and proportions
- Basic probability and financial calculations
Generate questions that mirror the style and difficulty of actual NBT AQL papers.`;
      }
    }

    // Generate questions in batches if needed
    const allQuestions: any[] = [];
    const batchSize = count;
    const totalBatches = Math.ceil(requestedCount / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const remaining = requestedCount - allQuestions.length;
      const batchCount = Math.min(batchSize, remaining);
      if (batchCount <= 0) break;

      const batchSeed = `${uniqueSeed} | Batch: ${batch + 1}/${totalBatches}`;

      const systemPrompt = `You are an expert NBT (National Benchmark Test) question writer. Generate EXACTLY ${batchCount} UNIQUE, high-quality practice questions for the NBT ${section} section.

${topicHint}

CRITICAL REQUIREMENTS:
- Each question MUST be completely different from the others
- Questions must vary in topic, style, and approach
- Include a mix of difficulty levels: some easy, mostly medium, some hard
- Questions must be realistic NBT-style multiple choice questions
- ${batchSeed}

For each question provide:
1. A clear, well-written question text
2. Exactly 4 options labeled A, B, C, D
3. The correct answer (must exactly match one option)
4. A detailed step-by-step explanation

Return ONLY a valid JSON array of objects with these exact keys:
- "title": short topic label (e.g. "Quadratic Functions", "Reading Comprehension")
- "question_text": the full question
- "options": array of exactly 4 strings
- "correct_answer": string matching one option exactly
- "explanation": detailed solution explanation
- "difficulty": "easy", "medium", or "hard"

NO markdown. NO code blocks. ONLY the JSON array.`;

      console.log(`[generate-exam-nbt] Batch ${batch + 1}/${totalBatches}: generating ${batchCount} questions`);

      const result = await callGeminiWithFallback(systemPrompt, contentForAI, {
        temperature: 0.8,
      });

      let questions: any[];
      try {
        questions = parseJsonResponse(result.content);
      } catch (parseErr) {
        console.error('[generate-exam-nbt] JSON parse error:', parseErr);
        console.error('[generate-exam-nbt] Raw content (first 500 chars):', result.content.substring(0, 500));
        
        // Try to recover truncated JSON by closing the array
        try {
          let cleaned = result.content.trim();
          if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
          if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
          if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
          cleaned = cleaned.trim();
          
          // Find the last complete object by finding the last '}' followed by potential ']'
          const lastBrace = cleaned.lastIndexOf('}');
          if (lastBrace > 0) {
            cleaned = cleaned.substring(0, lastBrace + 1) + ']';
            if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
            questions = JSON.parse(cleaned);
            console.log(`[generate-exam-nbt] Recovered ${questions.length} questions from truncated JSON`);
          } else {
            throw new Error('Cannot recover truncated JSON');
          }
        } catch (recoveryErr) {
          console.error('[generate-exam-nbt] JSON recovery also failed:', recoveryErr);
          if (batch === 0) {
            throw new Error('Failed to parse AI response as valid JSON');
          }
          // If we already have some questions from previous batches, continue
          break;
        }
      }

      if (Array.isArray(questions) && questions.length > 0) {
        allQuestions.push(...questions);
      } else if (batch === 0) {
        throw new Error('AI returned empty or invalid questions array');
      }
    }

    if (allQuestions.length === 0) {
      throw new Error('No questions were generated');
    }

    console.log(`[generate-exam-nbt] Total generated: ${allQuestions.length} questions, saving to DB...`);

    // Insert all questions in batch
    const questionsToInsert = allQuestions.map((q: any) => ({
      user_id: user.id,
      section: section,
      title: q.title || `NBT ${section} Question`,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty || diff,
      question_type: 'multiple_choice',
      is_official: false,
      is_published: true,
    }));

    const { data: savedQuestions, error: questionsError } = await supabase
      .from('nbt_practice_questions')
      .insert(questionsToInsert)
      .select('id');

    if (questionsError) {
      console.error('[generate-exam-nbt] Error saving questions:', questionsError);
      throw questionsError;
    }

    console.log(`[generate-exam-nbt] Saved ${savedQuestions?.length} questions`);

    // Link questions to the test via nbt_test_questions
    if (testId && savedQuestions && savedQuestions.length > 0) {
      await supabase.from('nbt_test_questions').delete().eq('test_id', testId);

      const testQuestionLinks = savedQuestions.map((q: any, index: number) => ({
        test_id: testId,
        question_id: q.id,
        order_index: index,
      }));

      const { error: linkError } = await supabase
        .from('nbt_test_questions')
        .insert(testQuestionLinks);

      if (linkError) {
        console.error('[generate-exam-nbt] Error linking questions to test:', linkError);
        throw linkError;
      }

      console.log(`[generate-exam-nbt] Linked ${savedQuestions.length} questions to test ${testId}`);

      await supabase
        .from('nbt_practice_tests')
        .update({ total_questions: savedQuestions.length, is_published: true })
        .eq('id', testId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        testId: testId || null,
        questionCount: savedQuestions?.length || allQuestions.length,
        message: `Successfully generated ${savedQuestions?.length} questions for NBT ${section}.`,
        model: 'gemini',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-exam-nbt] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
