import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

async function detectNBTContent(text: string): Promise<{ isNBT: boolean; reason?: string }> {
  const systemPrompt = `You are a content classifier for a South African education platform.
Detect if the text is related to the NBT (National Benchmark Test). Look for mentions of "NBT", AQL, MAT, QL sections.
Respond with JSON: { "isNBT": true/false, "reason": "why" }. ONLY respond with JSON.`;

  try {
    const result = await callGeminiWithFallback(systemPrompt, `Analyze: ${text.slice(0, 5000)}`, { temperature: 0.2 });
    return JSON.parse(result.content.replace(/```json|```/g, '').trim());
  } catch {
    return { isNBT: false };
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

    const body: LessonRequest = await req.json();
    if (!body.documentText || body.documentText.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or empty documentText' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const chunkNumber = body.chunkNumber || 1;
    const totalChunks = body.totalChunks || 1;

    // NBT content blocking
    if (chunkNumber === 1) {
      const nbtCheck = await detectNBTContent(body.documentText);
      if (nbtCheck.isNBT) {
        return new Response(
          JSON.stringify({ error: 'NBT_CONTENT_DETECTED', message: 'This content appears to be NBT-related. Please use the dedicated NBT section.', reason: nbtCheck.reason }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[generate-lesson-gemini] Chunk ${chunkNumber}/${totalChunks}`);

    // Stage 1: Preprocess
    const batchCtx = body.batchInfo ? `\nBatch ${body.batchInfo.batchNumber} of ${body.batchInfo.totalBatches}.` : '';
    const preprocessResult = await callGeminiWithFallback(
      `You are an educational content analyzer. Extract and organize ONLY core educational content. IGNORE activities, exercises, worksheets. FOCUS on factual content, concepts, definitions. Output a structured Markdown outline.`,
      `Analyze chunk (${chunkNumber} of ${totalChunks}):${batchCtx}\n\n${body.documentText}`,
      { temperature: 0.3 }
    );

    // Stage 2: Generate lesson
    const contextSection = body.previousContext ? `\nPREVIOUS CONTEXT:\n${body.previousContext.slice(-2000)}` : '';
    const lessonResult = await callGeminiWithFallback(
      `You are an expert educational content creator. Generate comprehensive lessons in Markdown. IGNORE activities from source. Use # ## ### **bold** *italics* > notes. Start with learning objectives, define terms, provide examples, end with summary.`,
      `Create lesson from chunk ${chunkNumber} of ${totalChunks}${batchCtx}.\n\nOUTLINE:\n${preprocessResult.content}\n\nORIGINAL:\n${body.documentText}${contextSection}`,
      { temperature: 0.3, usePro: true }
    );

    const tokenUsage = {
      inputTokens: preprocessResult.inputTokens + lessonResult.inputTokens,
      outputTokens: preprocessResult.outputTokens + lessonResult.outputTokens,
      totalTokens: preprocessResult.inputTokens + preprocessResult.outputTokens + lessonResult.inputTokens + lessonResult.outputTokens,
    };

    return new Response(
      JSON.stringify({ lessonContent: lessonResult.content, chunkNumber, totalChunks, batchInfo: body.batchInfo, tokenUsage, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-lesson-gemini:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'RATE_LIMIT') {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
