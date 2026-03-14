import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

async function detectNBTContent(text: string): Promise<{ isNBT: boolean; reason?: string }> {
  if (!GOOGLE_API_KEY) return { isNBT: false };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  const systemPrompt = `You are a content classifier for a South African education platform.
  Your task is to detect if the provided text is related to the National Benchmark Test (NBT), specifically AQL (Academic & Quantitative Literacy), MAT (Mathematics), or QL (Quantitative Literacy).

  Look for:
  - Explicit mentions of "NBT", "National Benchmark Test"
  - AQL, MAT, QL sections in an assessment context
  - Specific NBT question styles (e.g., AQL vocabulary or MAT section patterns)

  Respond with JSON: { "isNBT": true/false, "reason": "why" }
  ONLY respond with JSON.`;

  const userPrompt = `Analyze this transcript for NBT content: ${text.slice(0, 5000)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    });
    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
    return parsed;
  } catch (err) {
    console.error('Error detecting NBT content:', err);
    return { isNBT: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

    const TRANSCRIPT_API_KEY = Deno.env.get("TRANSCRIPT_API_KEY");
    if (!TRANSCRIPT_API_KEY) {
      throw new Error("TRANSCRIPT_API_KEY is not configured");
    }

    const { videoUrl } = await req.json();
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "videoUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoUrl)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TRANSCRIPT_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`TranscriptAPI error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Extract text for easier consumption by generate-lesson-gemini
    let text = "";
    if (data.transcript && Array.isArray(data.transcript)) {
      text = data.transcript.map((seg: any) => seg.text || "").join(" ").trim();
    } else if (data.text) {
      text = data.text;
    } else if (typeof data === "string") {
      text = data;
    }

    // Task 18: NBT Content Blocking
    console.log('Checking for NBT content in transcript...');
    const nbtCheck = await detectNBTContent(text);
    if (nbtCheck.isNBT) {
      console.warn('NBT content detected in YouTube transcript! Blocking generation.');
      return new Response(
        JSON.stringify({
          error: 'NBT_CONTENT_DETECTED',
          message: 'This video appears to be NBT-related. Please use the dedicated NBT section for NBT preparation.',
          reason: nbtCheck.reason
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ...data, text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error fetching transcript:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
