import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback } from "./_shared/gemini-fallback.ts";

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
Your ONLY job is to detect if the uploaded document is an actual NBT (National Benchmark Test) exam paper or official NBT practice test.

Rules:
- Return isNBT=true ONLY if the document IS an NBT exam/test paper (contains NBT AQL, MAT, or QL test questions as the primary content).
- Return isNBT=false for: textbooks, study guides, notes, worksheets, past papers (non-NBT), lesson content, or any document that merely MENTIONS the NBT.
- When in doubt, return isNBT=false. Only block when you are highly confident it is an actual NBT paper.

Respond ONLY with valid JSON, no markdown: { "isNBT": true/false, "reason": "brief reason" }`;

  try {
    const result = await callGeminiWithFallback(systemPrompt, `Classify this document:\n\n${text.slice(0, 3000)}`, { temperature: 0.1 });
    const parsed = JSON.parse(result.content.replace(/```json|```/g, '').trim());
    return { isNBT: parsed.isNBT === true, reason: parsed.reason };
  } catch (e) {
    console.warn('[generate-lesson-gemini] NBT detection failed, defaulting to allow:', e);
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

    if (chunkNumber === 1) {
      const nbtTimeoutPromise = new Promise<{ isNBT: false }>((resolve) =>
        setTimeout(() => resolve({ isNBT: false }), 5000)
      );
      const nbtCheck = await Promise.race([detectNBTContent(body.documentText), nbtTimeoutPromise]);
      if (nbtCheck.isNBT) {
        console.log('[generate-lesson-gemini] NBT content blocked:', (nbtCheck as any).reason);
        return new Response(
          JSON.stringify({ error: 'NBT_CONTENT_DETECTED', message: 'This content appears to be an NBT exam paper. Please use the dedicated NBT section.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[generate-lesson-gemini] Chunk ${chunkNumber}/${totalChunks}`);

    const batchCtx = body.batchInfo ? `\nBatch ${body.batchInfo.batchNumber} of ${body.batchInfo.totalBatches}.` : '';
    const contextSection = body.previousContext ? `\n\nPREVIOUS CONTEXT (for continuity):\n${body.previousContext.slice(-2000)}` : '';

    const lessonResult = await callGeminiWithFallback(
      `You are an expert South African high school educational content creator.
Generate a comprehensive, well-structured lesson in Markdown from the provided source material.

STRICT RULES:
- IGNORE all activities, exercises, worksheets, and tasks from the source — extract only core content.
- Structure: start with ## Learning Objectives, then define key terms, explain concepts with examples, end with ## Summary.
- Use # ## ### for headings, **bold** for key terms, *italics* for emphasis, > for important notes/definitions.
- Write for a South African high school student (CAPS/IEB). Be clear, thorough, and engaging.
- If this is part of a multi-chunk document, maintain continuity with the previous context provided.`,
      `SOURCE MATERIAL (chunk ${chunkNumber} of ${totalChunks}${batchCtx}):\n\n${body.documentText}${contextSection}`,
      { temperature: 0.3, usePro: true }
    );

    const tokenUsage = {
      inputTokens: lessonResult.inputTokens,
      outputTokens: lessonResult.outputTokens,
      totalTokens: lessonResult.inputTokens + lessonResult.outputTokens,
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