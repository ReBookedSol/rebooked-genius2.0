import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface LessonRequest {
  documentText: string;
  chunkNumber: number;
  totalChunks: number;
  previousContext?: string;
  batchInfo?: {
    batchNumber: number;
    totalBatches: number;
    pagesInBatch: number;
  };
}

interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, useCheapModel: boolean = false): Promise<AIResponse> {
  // Use GPT-4o-mini for preprocessing (fast/cheap), GPT-4o for detailed generation (quality)
  const model = useCheapModel ? 'gpt-4o-mini' : 'gpt-4o';

  console.log(`Calling OpenAI model: ${model}`);

  let response;
  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.3,
      }),
    });

    if (response.status === 429 && retries < maxRetries) {
      retries++;
      console.log(`OpenAI rate limit hit, retrying (${retries}/${maxRetries})...`);
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    const errorText = await response?.text() || "No response";
    console.error(`OpenAI API error: ${response?.status} - ${errorText}`);

    if (response?.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response?.status === 401 || response?.status === 403) {
      throw new Error('API_KEY_INVALID');
    }
    throw new Error(`OpenAI API error: ${response?.status}`);
  }

  const data = await response.json();

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    console.error('Empty response from OpenAI:', JSON.stringify(data));
    throw new Error('Empty response from OpenAI');
  }

  return {
    content: text,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

async function detectNBTContent(text: string): Promise<{ isNBT: boolean; reason?: string }> {
  const systemPrompt = `You are a content classifier for a South African education platform.
  Your task is to detect if the provided text is related to the National Benchmark Test (NBT), specifically AQL (Academic & Quantitative Literacy), MAT (Mathematics), or QL (Quantitative Literacy).

  Look for:
  - Explicit mentions of "NBT", "National Benchmark Test"
  - AQL, MAT, QL sections in an assessment context
  - Specific NBT question styles (e.g., AQL vocabulary or MAT section patterns)

  Respond with JSON: { "isNBT": true/false, "reason": "why" }
  ONLY respond with JSON.`;

  const userPrompt = `Analyze this text for NBT content: ${text.slice(0, 5000)}`;

  try {
    const result = await callOpenAI(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(result.content.replace(/```json|```/g, '').trim());
    return parsed;
  } catch (err) {
    console.error('Error detecting NBT content:', err);
    return { isNBT: false };
  }
}

// Stage 1: Preprocess with GPT-4o-mini (fast/cheap)
async function preprocessChunk(documentText: string, chunkNumber: number, totalChunks: number, batchInfo?: LessonRequest['batchInfo']): Promise<AIResponse> {
  const batchContext = batchInfo
    ? `\n\nThis is batch ${batchInfo.batchNumber} of ${batchInfo.totalBatches} (${batchInfo.pagesInBatch} pages in this batch).`
    : '';

  const systemPrompt = `You are an educational content analyzer. Your task is to extract and organize ONLY the core educational content from document chunks to prepare for detailed lesson generation.

CRITICAL INSTRUCTIONS:
- IGNORE all activities, exercises, worksheets, and interactive elements
- IGNORE instructions like "discuss with your partner", "complete the activity", "fill in the blanks"
- FOCUS ONLY on factual content, concepts, definitions, theories, and explanations
- Extract the pure knowledge and information, not the pedagogical activities

Output a structured outline in Markdown format with:
1. Main topics/headings identified
2. Key terms and definitions
3. Important concepts and relationships
4. Summary of critical information (facts, data, explanations)
5. Suggested lesson structure based on content flow

Be thorough but concise. Focus on the actual content, not activities.`;

  const userPrompt = `Analyze this document chunk (${chunkNumber} of ${totalChunks}) and extract ONLY the core educational content (ignore all activities and exercises):${batchContext}

${documentText}

Provide a detailed outline that captures all important factual content.`;

  return await callOpenAI(systemPrompt, userPrompt, true); // Use GPT-4o-mini for speed
}

// Stage 2: Generate detailed lesson with GPT-4o (quality)
async function generateDetailedLesson(
  documentText: string,
  outline: string,
  chunkNumber: number,
  totalChunks: number,
  previousContext?: string,
  batchInfo?: LessonRequest['batchInfo']
): Promise<AIResponse> {
  const contextSection = previousContext
    ? `\n\nPREVIOUS LESSON CONTEXT (maintain continuity):\n${previousContext.slice(-2000)}`
    : '';

  const batchContext = batchInfo
    ? `\n\nProcessing batch ${batchInfo.batchNumber} of ${batchInfo.totalBatches} (${batchInfo.pagesInBatch} pages).`
    : '';

  const systemPrompt = `You are an expert educational content creator. Generate comprehensive, well-structured lessons in Markdown format.

CRITICAL: Focus ONLY on explaining the actual content, concepts, and knowledge.
DO NOT include or reference:
- Activities from the source document
- Exercises or worksheets
- "Discuss with your partner" type instructions
- Fill-in-the-blank or interactive elements
- Any pedagogical activities from the original

Instead, CREATE NEW educational content that:
- Explains concepts clearly and thoroughly
- Provides your own examples to illustrate points
- Includes YOUR OWN practice questions (not from the source)

FORMATTING REQUIREMENTS:
- Use # for main lesson title
- Use ## for major sections
- Use ### for subsections
- Use **bold** for key terms and definitions
- Use *italics* for emphasis
- Use - for bullet points and 1. for numbered lists
- Use | for tables when presenting comparative information
- Use --- for section breaks
- Use > for important notes or quotes

CONTENT REQUIREMENTS:
- Start with clear learning objectives
- Define all technical terms thoroughly
- Provide real-world examples (your own, not from source activities)
- End with a summary of key takeaways
- Maintain continuity with previous chunks if provided`;

  const userPrompt = `Create a detailed educational lesson from this content. IGNORE any activities/exercises in the source - focus on explaining the concepts.

CHUNK ${chunkNumber} OF ${totalChunks}${batchContext}

PREPROCESSED OUTLINE:
${outline}

ORIGINAL DOCUMENT TEXT:
${documentText}
${contextSection}

Generate a complete, well-formatted lesson that thoroughly explains all concepts. Do not copy activities from the source.`;

  return await callOpenAI(systemPrompt, userPrompt, false); // Use GPT-4o for quality
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      throw new Error('OpenAI API key not configured');
    }

    const body: LessonRequest = await req.json();

    if (!body.documentText || body.documentText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty documentText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chunkNumber = body.chunkNumber || 1;
    const totalChunks = body.totalChunks || 1;

    // Task 18: NBT Content Blocking
    if (chunkNumber === 1) {
      console.log('Checking for NBT content...');
      const nbtCheck = await detectNBTContent(body.documentText);
      if (nbtCheck.isNBT) {
        console.warn('NBT content detected in normal study section! Blocking generation.');
        return new Response(
          JSON.stringify({
            error: 'NBT_CONTENT_DETECTED',
            message: 'This content appears to be NBT-related. Please use the dedicated NBT section for NBT preparation.',
            reason: nbtCheck.reason
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[OpenAI] Processing chunk ${chunkNumber}/${totalChunks}${body.batchInfo ? `, batch ${body.batchInfo.batchNumber}/${body.batchInfo.totalBatches}` : ''}`);

    // Stage 1: Preprocess with GPT-4o-mini
    console.log('Stage 1: Preprocessing with GPT-4o-mini...');
    const preprocessResult = await preprocessChunk(body.documentText, chunkNumber, totalChunks, body.batchInfo);

    // Stage 2: Generate detailed lesson with GPT-4o
    console.log('Stage 2: Generating detailed lesson with GPT-4o...');
    const lessonResult = await generateDetailedLesson(
      body.documentText,
      preprocessResult.content,
      chunkNumber,
      totalChunks,
      body.previousContext,
      body.batchInfo
    );

    // Calculate total token usage
    const tokenUsage = {
      inputTokens: preprocessResult.inputTokens + lessonResult.inputTokens,
      outputTokens: preprocessResult.outputTokens + lessonResult.outputTokens,
      totalTokens: preprocessResult.inputTokens + preprocessResult.outputTokens + lessonResult.inputTokens + lessonResult.outputTokens,
    };

    console.log(`Successfully generated lesson for chunk ${chunkNumber}. Tokens: ${tokenUsage.totalTokens}`);

    return new Response(
      JSON.stringify({
        lessonContent: lessonResult.content,
        chunkNumber,
        totalChunks,
        batchInfo: body.batchInfo,
        tokenUsage,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-lesson-openai:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'RATE_LIMIT') {
      return new Response(
        JSON.stringify({ error: 'OpenAI API rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message === 'API_KEY_INVALID') {
      return new Response(
        JSON.stringify({ error: 'Invalid OpenAI API key. Please check your configuration.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
