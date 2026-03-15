import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

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

async function callGemini(systemPrompt: string, userPrompt: string, useFlash: boolean = false): Promise<AIResponse> {
  // Model fallback chains
  const flashModels = [
    'gemini-2.5-flash-lite-preview-09-2025',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ];

  const proModels = [
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
  ];

  const modelsToTry = useFlash ? flashModels : proModels;
  let lastError: Error | null = null;

  console.log(`[callGemini] Starting fallback chain. Models to try (${useFlash ? 'Flash' : 'Pro'}): ${modelsToTry.join(', ')}`);

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
      console.log(`Calling Google Gemini model: ${model}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 65536,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} failed with status ${response.status}: ${errorText}`);

        if (response.status === 429) {
          lastError = new Error('RATE_LIMIT');
          continue; // Try next model
        }
        if (response.status === 404 || response.status === 400) {
          lastError = new Error(`Model not available: ${model}`);
          continue; // Try next model
        }
        if (response.status === 403) {
          lastError = new Error('API_KEY_INVALID');
          continue; // Try next model
        }
        lastError = new Error(`Gemini API error: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Extract text from Gemini response
      let text = '';
      const parts = data.candidates?.[0]?.content?.parts || [];
      // Get the last text part (skip thought parts which have "thought" field)
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].text && !parts[i].thought) {
          text = parts[i].text;
          break;
        }
      }
      // Fallback: if all parts have "thought", just take the last part's text
      if (!text && parts.length > 0) {
        text = parts[parts.length - 1].text || '';
      }

      if (!text) {
        console.warn(`❌ Empty response from model ${model}, trying next...`);
        console.warn(`Response structure: ${JSON.stringify(data.candidates?.[0]?.content)}`);
        lastError = new Error('Empty response from Gemini');
        continue;
      }

      // Extract token usage from Gemini response
      const usageMetadata = data.usageMetadata || {};

      console.log(`✅ Success with model ${model}. Generated ${text.length} characters. Tokens: input=${usageMetadata.promptTokenCount || 0}, output=${usageMetadata.candidatesTokenCount || 0}`);
      return {
        content: text,
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error with model ${model}:`, lastError.message);
      continue;
    }
  }

  // All models failed
  console.error(`❌ [callGemini] All models failed. Tried: ${modelsToTry.join(', ')}`);
  console.error(`Last error: ${lastError?.message}`);

  if (lastError?.message === 'API_KEY_INVALID') {
    throw lastError;
  }
  throw lastError || new Error(`All Gemini models failed: ${modelsToTry.join(', ')}`);
}

// Stage 1: Preprocess with Flash model (fast)
async function preprocessChunk(documentText: string, chunkNumber: number, totalChunks: number, batchInfo?: LessonRequest['batchInfo']): Promise<AIResponse> {
  const batchContext = batchInfo
    ? `\n\nThis is batch ${batchInfo.batchNumber} of ${batchInfo.totalBatches} (${batchInfo.pagesInBatch} pages in this batch).`
    : '';

  const systemPrompt = `You are an educational content analyzer. Your task is to extract and organize ONLY the core educational content from document chunks or video transcripts to prepare for detailed lesson generation.

CRITICAL INSTRUCTIONS:
- Source may be a document chunk or a video transcript (which may lack punctuation).
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

  return await callGemini(systemPrompt, userPrompt, true); // Use Flash Lite for speed
}

// Stage 2: Generate detailed lesson with Flash Lite model
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

  return await callGemini(systemPrompt, userPrompt, false); // Use Pro models for better quality
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
    const result = await callGemini(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(result.content.replace(/```json|```/g, '').trim());
    return parsed;
  } catch (err) {
    console.error('Error detecting NBT content:', err);
    return { isNBT: false };
  }
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

    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_GEMINI_API_KEY not configured');
      throw new Error('Google Gemini API key not configured');
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

    console.log(`[Google Gemini] Processing chunk ${chunkNumber}/${totalChunks}${body.batchInfo ? `, batch ${body.batchInfo.batchNumber}/${body.batchInfo.totalBatches}` : ''}`);

    // Stage 1: Preprocess
    console.log('Stage 1: Preprocessing with Gemini Flash models...');
    const preprocessResult = await preprocessChunk(body.documentText, chunkNumber, totalChunks, body.batchInfo);
    console.log(`Stage 1 complete. Generated outline with ${preprocessResult.content.length} characters.`);

    // Stage 2: Generate detailed lesson
    console.log('Stage 2: Generating detailed lesson with Gemini Pro models...');
    const lessonResult = await generateDetailedLesson(
      body.documentText,
      preprocessResult.content,
      chunkNumber,
      totalChunks,
      body.previousContext,
      body.batchInfo
    );
    console.log(`Stage 2 complete. Generated lesson with ${lessonResult.content.length} characters.`);

    // Calculate total token usage
    const tokenUsage = {
      inputTokens: preprocessResult.inputTokens + lessonResult.inputTokens,
      outputTokens: preprocessResult.outputTokens + lessonResult.outputTokens,
      totalTokens: preprocessResult.inputTokens + preprocessResult.outputTokens + lessonResult.inputTokens + lessonResult.outputTokens,
    };

    console.log(`✅ Successfully generated lesson for chunk ${chunkNumber}/${totalChunks}. Tokens used: ${tokenUsage.totalTokens}`);

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
    console.error('❌ Error in generate-lesson-gemini:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'RATE_LIMIT') {
      console.warn('Rate limit hit - returning 429');
      return new Response(
        JSON.stringify({ error: 'Google API rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message === 'API_KEY_INVALID') {
      console.error('API key invalid');
      return new Response(
        JSON.stringify({ error: 'Invalid Google API key. Please check your configuration.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error(`Returning 500 error: ${message}`);
    return new Response(
      JSON.stringify({ error: message, details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
