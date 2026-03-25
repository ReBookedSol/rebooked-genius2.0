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

    const { messages, language = "en", context, clientSystemPrompt } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        userId = user.id;
        userEmail = user.email || null;
        userName = user.user_metadata?.first_name || "there";

        const { data: canUse } = await supabase.rpc("can_use_ai", { p_user_id: user.id });

        if (!canUse) {
          // Determine which limit was hit and send email if it's the first time
          const { data: profile } = await supabase
            .from('profiles')
            .select('ai_limit_email_sent_at, five_day_limit_email_sent_at, full_name')
            .eq('user_id', userId)
            .maybeSingle();

          const today = new Date().toISOString().split('T')[0];
          const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

          // Check token usage for today
          const { data: usage } = await supabase
            .from('ai_usage')
            .select('token_count')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();

          // Check active days this month
          const { count: activeDays } = await supabase
            .from("ai_usage")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("date", monthStart)
            .gt("token_count", 0);

          if (activeDays && activeDays > 5) {
            // 5-day limit reached
            if (!profile?.five_day_limit_email_sent_at && userEmail) {
              await supabase.functions.invoke("send-email", {
                body: {
                  to: userEmail,
                  template: "five_day_limit",
                  props: { name: userName }
                }
              });
              await supabase.from('profiles').update({ five_day_limit_email_sent_at: new Date().toISOString() }).eq('user_id', userId);
            }
            return new Response(
              JSON.stringify({ error: "You've reached your free 5-day active limit for this month. Upgrade to Pro for unlimited usage." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else if (usage && usage.token_count >= 5000) {
            // Daily token limit reached
            if (!profile?.ai_limit_email_sent_at && userEmail) {
              await supabase.functions.invoke("send-email", {
                body: {
                  to: userEmail,
                  template: "usage_limit",
                  props: { name: userName }
                }
              });
              await supabase.from('profiles').update({ ai_limit_email_sent_at: new Date().toISOString() }).eq('user_id', userId);
            }
            return new Response(
              JSON.stringify({ error: "Daily AI token limit reached (5,000 tokens/day). Upgrade to Pro for unlimited usage." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Generic block if logic above didn't catch specific reason (rare)
          return new Response(
            JSON.stringify({ error: "AI usage limit reached. Upgrade to Pro for unlimited usage." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.rpc("increment_ai_usage", { p_user_id: user.id });
      }
    }

    let contextInfo = "";
    if (context) {
      if (context.currentPage) contextInfo += `\nThe student is currently on the ${context.currentPage} page.`;
      if (context.documentTitle) contextInfo += `\nThey are viewing a document titled: "${context.documentTitle}".`;
      if (context.documentContent) contextInfo += `\nDocument content excerpt: ${context.documentContent.substring(0, 3000)}`;
      if (context.pastPaper) contextInfo += `\nThey are working on a past paper: ${context.pastPaper.title} (${context.pastPaper.year}, ${context.pastPaper.subject}).`;
      if (context.pastPaperQuestion) contextInfo += `\nSpecific Question Context: ${context.pastPaperQuestion}`;
      if (context.studySession) contextInfo += `\nCurrent study session: ${context.studySession.subject}, studying for ${context.studySession.duration} minutes.`;
      if (context.recentQuizResults) contextInfo += `\nRecent quiz performance: ${context.recentQuizResults.score}/${context.recentQuizResults.total} (${context.recentQuizResults.percentage}%).`;
      if (context.userAnalytics) contextInfo += `\nUser Analytics: Total study time: ${context.userAnalytics.totalStudyTime || 0} minutes. Quiz average: ${context.userAnalytics.quizPerformance?.averageScore?.toFixed(1) || 'N/A'}%. Flashcard mastery: ${context.userAnalytics.flashcardPerformance?.masteryPercentage?.toFixed(0) || 'N/A'}%.`;
      if (context.analyticsHint) contextInfo += `\n${context.analyticsHint}`;
      if (context.activeQuiz) contextInfo += `\nThe student is currently taking a Quiz. Question ${context.activeQuiz.index + 1}/${context.activeQuiz.total}: "${context.activeQuiz.question}". ${context.activeQuiz.options ? `Options: ${context.activeQuiz.options.join(', ')}` : ''}`;
      if (context.activeExam) contextInfo += `\nThe student is currently taking an Exam. Question ${context.activeExam.index + 1}/${context.activeExam.total}: "${context.activeExam.question}". ${context.activeExam.options ? `Options: ${context.activeExam.options.join(', ')}` : ''}`;
      if (context.activeNbtTest) contextInfo += `\nThe student is currently taking an NBT Practice Test (${context.activeNbtTest.section}). Question ${context.activeNbtTest.index + 1}/${context.activeNbtTest.total}: "${context.activeNbtTest.question}". ${context.activeNbtTest.options ? `Options: ${context.activeNbtTest.options.join(', ')}` : ''}`;
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
- Provide step-by-step solutions when needed
- Suggest study techniques and memory aids
- Be encouraging while maintaining academic rigor
- BE CONCISE: Simple questions get direct, brief answers. Only write detailed explanations for complex topics.
- Save tokens and student credits — no filler, no unnecessary repetition.

ANSWER POLICY:
Genius believes every student deserves a clear answer. Whether it's homework, a quiz, a past paper, or an NBT — always answer the question. Never withhold an answer.

Preferred approach for assessments (quiz, exam, past paper, NBT):
1. Give the answer clearly.
2. Then briefly explain the concept behind it so the student actually learns.
3. If the student seems to be guessing or stuck, offer a quick hint first — but if they want the answer straight away, give it without hesitation.

Never make a student feel bad for wanting the answer. Learning happens in many ways — sometimes seeing the answer IS the lesson.

Subjects: Mathematics, Physical Sciences, Life Sciences, English, Afrikaans, History, Geography, Accounting, Business Studies, Information Technology.

Help students by:
1. Understanding their question
2. Identifying any misconceptions
3. Giving a clear answer + explanation
4. Optionally verifying understanding with a follow-up question

Always be patient, clear, and encouraging. If the student is working on a past paper or document, reference it when relevant.
`;
    }

    if (clientSystemPrompt) {
      systemPrompt += `\n\n=== ADDITIONAL FORMATTING INSTRUCTIONS ===\n${clientSystemPrompt}`;
    }

    const userContentLength = messages.reduce((sum: number, msg: { role: string; content: string }) => {
      return sum + (msg.content?.length || 0);
    }, 0);

    const conversationHistory = messages.map((msg: { role: string; content: string }) => {
      const label = msg.role === "assistant" ? "Assistant" :
                    msg.role === "system" ? "System" : "Student";
      return `${label}: ${msg.content}`;
    }).join("\n\n");

    const result = await callGeminiWithFallback(
      systemPrompt,
      conversationHistory,
      {
        temperature: 0.7,
        ...(context?.inlineData ? { inlineData: context.inlineData } : {}),
        usePro: !!context?.inlineData
      }
    );

    const fullContent = result.content;

    if (userId) {
      try {
        const estimatedInputTokens = Math.ceil(userContentLength / 4);
        const estimatedOutputTokens = Math.ceil(fullContent.length / 4);
        const estimatedTokens = estimatedInputTokens + estimatedOutputTokens;

        await supabase.rpc("increment_ai_token_usage", {
          p_user_id: userId,
          p_tokens: estimatedTokens
        });
      } catch (e) {
        console.error("Token tracking error:", e);
      }
    }

    const encoder = new TextEncoder();
    const CHUNK_SIZE = 20;

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