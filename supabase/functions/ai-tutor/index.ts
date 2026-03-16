import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiWithFallback } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

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
    let userId: string | null = null;

    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          userId = user.id;
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

    // Extract userId from token if not already set
    if (!userId) {
      try {
        const ah = req.headers.get("Authorization");
        if (ah) {
          const token = ah.replace("Bearer ", "");
          const payload = JSON.parse(atob(token.split(".")[1]));
          userId = payload.sub || null;
        }
      } catch { /* ignore */ }
    }

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
      if (context.userAnalytics) {
        contextInfo += `\nUser Analytics: Total study time: ${context.userAnalytics.totalStudyTime || 0} minutes. Quiz average: ${context.userAnalytics.quizPerformance?.averageScore?.toFixed(1) || 'N/A'}%. Flashcard mastery: ${context.userAnalytics.flashcardPerformance?.masteryPercentage?.toFixed(0) || 'N/A'}%.`;
      }
      if (context.analyticsHint) {
        contextInfo += `\n${context.analyticsHint}`;
      }
      
      // Active assessment contexts
      if (context.activeQuiz) {
        contextInfo += `\nThe student is currently taking a Quiz. Question ${context.activeQuiz.index + 1}/${context.activeQuiz.total}: "${context.activeQuiz.question}". ${context.activeQuiz.options ? `Options: ${context.activeQuiz.options.join(', ')}` : ''}`;
      }
      if (context.activeExam) {
        contextInfo += `\nThe student is currently taking an Exam. Question ${context.activeExam.index + 1}/${context.activeExam.total}: "${context.activeExam.question}". ${context.activeExam.options ? `Options: ${context.activeExam.options.join(', ')}` : ''}`;
      }
      if (context.activeNbtTest) {
        contextInfo += `\nThe student is currently taking an NBT Practice Test (${context.activeNbtTest.section}). Question ${context.activeNbtTest.index + 1}/${context.activeNbtTest.total}: "${context.activeNbtTest.question}". ${context.activeNbtTest.options ? `Options: ${context.activeNbtTest.options.join(', ')}` : ''}`;
      }
    }

    let systemPrompt: string;

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
- CRITICAL INSTRUCTION: If the student is working on a quiz, exam, past paper, or NBT test, DO NOT GIVE THEM THE DIRECT ANSWER. Instead, guide their reasoning, provide hints, explain the concept behind the question, or ask them what they think the first step is.

Subjects include Mathematics, Physical Sciences, Life Sciences, English, Afrikaans, History, Geography, Accounting, Business Studies, Information Technology.

Help students by:
1. Understanding their question
2. Identifying misconceptions
3. Guiding through the solution
4. Verifying understanding with follow-up questions

Always be patient, clear, and encouraging. If the student is working on a past paper or document, reference it when relevant.
`;
    }

    // Build the user conversation as a single prompt for the fallback utility
    const userContentLength = messages.reduce((sum: number, msg: { role: string; content: string }) => {
      return sum + (msg.content?.length || 0);
    }, 0);

    // Build conversation history as a formatted string for the fallback
    const conversationHistory = messages.map((msg: { role: string; content: string }) => {
      const label = msg.role === "assistant" ? "Assistant" : "Student";
      return `${label}: ${msg.content}`;
    }).join("\n\n");

    // Call Gemini with fallback cascade
    const result = await callGeminiWithFallback(
      systemPrompt,
      conversationHistory,
      { 
        temperature: 0.7,
        ...(context?.inlineData ? { inlineData: context.inlineData } : {}),
        usePro: !!context?.inlineData // Images often need Pro models in some regions
      }
    );

    const fullContent = result.content;

    // Track token usage
    if (userId) {
      try {
        const estimatedInputTokens = Math.ceil(userContentLength / 4);
        const estimatedOutputTokens = Math.ceil(fullContent.length / 4);
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

    // Stream the response back as SSE to match the client's expected format
    const encoder = new TextEncoder();
    const CHUNK_SIZE = 20; // Characters per chunk for natural streaming feel

    const stream = new ReadableStream({
      start(controller) {
        let pos = 0;
        const sendChunk = () => {
          if (pos >= fullContent.length) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const chunk = fullContent.slice(pos, pos + CHUNK_SIZE);
          pos += CHUNK_SIZE;

          const openAIFormat = {
            choices: [{ delta: { content: chunk }, index: 0 }]
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));

          // Small delay for natural streaming feel
          setTimeout(sendChunk, 10);
        };
        sendChunk();
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in AI tutor function:", error);

    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    if (errorMsg === "RATE_LIMIT" || errorMsg.includes("429") || errorMsg.includes("rate limit")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});