import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!req.headers.get("content-type")?.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Expected application/json content type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, language = "en", context, tier = "free" } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          const { data: canUse } = await supabase.rpc("can_use_ai", { p_user_id: user.id });

          if (!canUse) {
            return new Response(
              JSON.stringify({ error: "Daily AI token limit reached (1,000 tokens/day). Upgrade to Pro for unlimited usage." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await supabase.rpc("increment_ai_usage", { p_user_id: user.id });
        }
      } catch (authError) {
        console.error("Auth check error (non-fatal):", authError);
      }
    }

    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    let systemPrompt: string;

    let contextInfo = "";
    if (context) {
      if (context.currentPage) {
        contextInfo += `\nThe student is currently on the ${context.currentPage} page.`;
      }
      if (context.documentTitle) {
        contextInfo += `\nThey are viewing a document titled: "${context.documentTitle}".`;
      }
      if (context.documentContent) {
        contextInfo += `\nDocument content excerpt: ${context.documentContent.substring(0, 3000)}`;
      }
      if (context.pastPaper) {
        contextInfo += `\nThey are working on a past paper: ${context.pastPaper.title} (${context.pastPaper.year}, ${context.pastPaper.subject}).`;
      }
      if (context.pastPaperQuestion) {
        contextInfo += `\nSpecific Question Context: ${context.pastPaperQuestion}`;
      }
      if (context.studySession) {
        contextInfo += `\nCurrent study session: ${context.studySession.subject}, studying for ${context.studySession.duration} minutes.`;
      }
      if (context.recentQuizResults) {
        contextInfo += `\nRecent quiz performance: ${context.recentQuizResults.score}/${context.recentQuizResults.total} (${context.recentQuizResults.percentage}%).`;
      }
    }

    if (language === "af") {
      systemPrompt = `
Jy is ReBooked Genius, 'n kundige AI-tutor vir Suid-Afrikaanse studente.
Jy spesialiseer in CAPS-, IEB- en Cambridge-kurrikula.
${contextInfo}

Onderrigbenadering:
- Breek komplekse konsepte eenvoudig af
- Gebruik relevante Suid-Afrikaanse voorbeelde
- Stel vervolgvrae om kritiese denke aan te moedig
- Verskaf stap-vir-stap-oplossings
- Stel studietegnieke en geheuehulpmiddels voor
- Wees bemoedigend terwyl jy akademiese strengheid handhaaf

Vakke sluit in Wiskunde, Fisiese Wetenskappe, Lewenswetenskappe, Engels, Afrikaans, Geskiedenis, Geografie, Rekeningkunde, Sakestudies, Inligtingtegnologie.

Help studente deur:
1. Hul vraag te verstaan
2. Misverstande te identifiseer
3. Hulle deur die oplossing te lei
4. Begrip met vervolgvrae te verifieer

Wees altyd geduldig, duidelik en bemoedigend.
`;
    } else {
      systemPrompt = `
You are ReBooked Genius, an expert AI tutor for South African students.
You specialize in CAPS, IEB, and Cambridge curricula.
${contextInfo}

Teaching approach:
- Break down complex concepts simply
- Use relevant South African examples
- Ask follow-up questions to encourage critical thinking
- Provide step-by-step solutions
- Suggest study techniques and memory aids
- Be encouraging while maintaining academic rigor
- BE CONCISE: If a student asks a simple question, provide a direct, brief answer. Do not write paragraphs unless necessary for complex explanations.
- Save tokens and student credits by avoiding unnecessary filler or long-winded responses.

Subjects include Mathematics, Physical Sciences, Life Sciences, English, Afrikaans, History, Geography, Accounting, Business Studies, Information Technology.

Help students by:
1. Understanding their question
2. Identifying misconceptions
3. Guiding through the solution
4. Verifying understanding with follow-up questions

Always be patient, clear, and encouraging. If the student is working on a past paper or document, reference it when relevant.
`;
    }

    // Build Gemini contents: system prompt + acknowledgment + user messages
    // We track only user message content length for fair token billing
    const userContentLength = messages.reduce((sum: number, msg: { role: string; content: string }) => {
      return sum + (msg.content?.length || 0);
    }, 0);

    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    geminiContents.unshift({
      role: "user",
      parts: [{ text: systemPrompt }]
    });

    geminiContents.splice(1, 0, {
      role: "model",
      parts: [{ text: "I understand. I am ReBooked Genius, ready to help South African students with their studies. How can I assist you today?" }]
    });

    // ✅ Gemini 2.5 Flash
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${GOOGLE_API_KEY}&alt=sse`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let totalOutputChars = 0;

    const userId = (() => {
      try {
        const ah = req.headers.get("Authorization");
        if (!ah) return null;
        const token = ah.replace("Bearer ", "");
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.sub || null;
      } catch {
        return null;
      }
    })();

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.candidates?.[0]?.content?.parts?.[0]?.text;

              if (content) {
                totalOutputChars += content.length;

                const openAIFormat = {
                  choices: [
                    {
                      delta: { content },
                      index: 0
                    }
                  ]
                };

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`)
                );
              }
            } catch {
              // ignore bad chunks
            }
          }
        }
      },
      async flush() {
        if (userId) {
          try {
            // Only count OUTPUT tokens + user input tokens (exclude system prompt)
            const estimatedInputTokens = Math.ceil(userContentLength / 4);
            const estimatedOutputTokens = Math.ceil(totalOutputChars / 4);
            const estimatedTokens = estimatedInputTokens + estimatedOutputTokens;

            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const sb = createClient(supabaseUrl, supabaseKey);

            await sb.rpc("increment_ai_token_usage", {
              p_user_id: userId,
              p_tokens: estimatedTokens
            });
          } catch (e) {
            console.error("Token tracking error:", e);
          }
        }
      }
    });

    const transformedStream = response.body?.pipeThrough(transformStream);

    return new Response(transformedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in AI tutor function:", error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});