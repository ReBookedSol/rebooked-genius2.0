import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface TestGenerationRequest {
  lessonId: string;
  knowledgeBaseId: string;
  userId: string;
  questionCount: number;
  questionTypes: string[];
}

interface Question {
  id: string;
  type: "multipleChoice" | "shortAnswer" | "stringForce" | "trueFalse" | "dropdown" | "matching" | "graph";
  text: string;
  options?: string[];
  answer?: string;
  correct_answers?: string[];
  matchingPairs?: { left: string; right: string }[];
  graphData?: any;
  explanation?: string;
}

interface TestContent {
  questions: Question[];
  totalQuestions: number;
  generatedAt: string;
  lessonId: string;
  questionTypes: string[];
  status: string;
}

async function generateTestWithGemini(
  lessonContent: string,
  questionCount: number,
  questionTypes: string[]
): Promise<TestContent> {
  if (!GOOGLE_API_KEY) {
    throw new Error("Google Gemini API key not configured");
  }

  console.log(`Generating ${questionCount} test questions with types:`, questionTypes);

  const model = "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const questionTypeDescriptions = questionTypes
    .map((type) => {
      switch (type) {
        case "multipleChoice":
          return "Multiple choice questions with 4 options";
        case "shortAnswer":
          return "Short answer questions requiring 1-3 sentence responses";
        case "stringForce":
          return "Fill-in-the-blank questions. Support variations using 'correct_answers' array.";
        case "trueFalse":
          return "True/False questions";
        case "dropdown":
          return "Sentence with missing parts selectable from options";
        case "matching":
          return "Match items from Column A to Column B using 'matchingPairs'";
        case "graph":
          return "Mathematics/Science graph interpretation questions with 'graphData'";
        default:
          return type;
      }
    })
    .join(", ");

  const systemPrompt = `You are an expert educator creating assessment questions. Generate ${questionCount} test questions based on the provided lesson content.
  Include these question types: ${questionTypeDescriptions}.

  Format your response as a valid JSON object with the following structure:
  {
    "questions": [
      {
        "id": "q1",
        "type": "multipleChoice|shortAnswer|stringForce|trueFalse|dropdown|matching|graph",
        "text": "The question text",
        "options": ["option1", "option2", "option3", "option4"],
        "answer": "The correct answer (single string)",
        "correct_answers": ["variation1", "variation2"],
        "matchingPairs": [{"left": "item1", "right": "match1"}],
        "graphData": { "functions": [], "points": [], "shapes": [], "config": {} },
        "explanation": "Why this is correct"
      }
    ]
  }

  Note:
  - The "options" field is required for multipleChoice and dropdown.
  - The "correct_answers" field is used for stringForce variations.
  - The "matchingPairs" field is required for matching.
  - The "graphData" field is required for graph type.
  
  Ensure questions test understanding, not just memorization.
  Make questions clear and appropriate for learning assessment.`;

  const userPrompt = `Generate ${questionCount} test questions from this lesson content:
  
  ${lessonContent}
  
  Distribute the questions across these types: ${questionTypeDescriptions}
  
  Return ONLY the JSON object, no other text.`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error response:", errorData);
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("No content in Gemini response");
    }

    const responseText = data.candidates[0].content.parts[0].text;
    console.log("Gemini response received, parsing JSON...");

    // Parse JSON response - handle markdown code blocks
    let jsonString = responseText;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    } else {
      // Try to extract JSON object directly
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    const parsedResponse = JSON.parse(jsonString);
    console.log(`Successfully parsed ${parsedResponse.questions?.length || 0} questions`);

    return {
      questions: parsedResponse.questions || [],
      totalQuestions: parsedResponse.questions?.length || questionCount,
      generatedAt: new Date().toISOString(),
      lessonId: "",
      questionTypes: questionTypes,
      status: "completed",
    };
  } catch (error) {
    console.error("Error generating test with Gemini:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: TestGenerationRequest | null = null;

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseAuth = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    payload = await req.json();
    const { lessonId, knowledgeBaseId, userId, questionCount, questionTypes } = payload!;

    console.log(`Generating test from lesson: ${lessonId} for knowledge_base: ${knowledgeBaseId}`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

    // Step 1: Fetch the lesson content
    const { data: lessonData, error: lessonError } = await supabase
      .from("knowledge_base")
      .select("title, content")
      .eq("id", lessonId)
      .eq("user_id", userId)
      .single();

    if (lessonError || !lessonData) {
      throw new Error(`Failed to fetch lesson: ${lessonError?.message}`);
    }

    console.log("Lesson fetched successfully:", lessonData.title);

    // Parse lesson content to get the text
    let lessonContent = "";
    try {
      const contentData = JSON.parse(lessonData.content);
      lessonContent = contentData.lesson || contentData.content || lessonData.content;
    } catch {
      lessonContent = lessonData.content;
    }

    // Step 2: Generate test questions using Gemini
    console.log("Generating test questions with Gemini...");
    const testData = await generateTestWithGemini(
      lessonContent,
      questionCount,
      questionTypes
    );
    testData.lessonId = lessonId;

    // Step 3: Update knowledge_base record with test content
    const { error: updateError } = await supabase
      .from("knowledge_base")
      .update({
        content: JSON.stringify(testData),
        tags: ["generated", "test", "completed"],
        is_active: true,
      })
      .eq("id", knowledgeBaseId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`Failed to update knowledge_base: ${updateError.message}`);
    }

    console.log("Test generation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test generated successfully",
        knowledgeBaseId,
        questionCount: testData.totalQuestions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating test:", error);

    // Try to update the record with failed status
    if (payload) {
      try {
        const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

        await supabase
          .from("knowledge_base")
          .update({
            tags: ["failed", "test"],
            is_active: false,
          })
          .eq("id", payload.knowledgeBaseId)
          .eq("user_id", payload.userId);
      } catch (innerError) {
        console.error("Failed to update failed status:", innerError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
