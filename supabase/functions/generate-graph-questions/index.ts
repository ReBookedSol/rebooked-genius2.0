import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  easy: `EASY difficulty: Ask simple identification questions.
- Read values from the graph (y-intercept, specific points)
- Identify the type of function
- State the gradient of a line
- Find where a line crosses an axis
- No multi-step calculations needed. Answers should be directly readable.`,

  medium: `MEDIUM difficulty: Require calculations and multi-step reasoning.
- Calculate gradient using two points: m = (y2-y1)/(x2-x1)
- Find midpoint of a line segment: M = ((x1+x2)/2, (y1+y2)/2)
- Solve for x-intercepts by setting y=0
- Find the equation of a line given two points
- Determine where two functions intersect (set f(x) = g(x))
- Calculate the distance between two points
Each sub-question MUST include a "calculation" field showing the full step-by-step working.`,

  hard: `HARD difficulty: Complex multi-step analysis requiring deep understanding.
- Prove properties algebraically
- Find equations of tangent/normal lines
- Solve systems of inequalities (where f(x) < g(x))
- Determine domain and range with justification
- Analyze composite functions
- Find areas of shapes formed by intersections
- Determine equations from transformations
- Analyze limits and asymptotic behavior
- Every sub-question MUST include a detailed "calculation" field showing ALL steps, substitutions, and algebraic manipulation.`,
};

const NBT_SECTION_PROMPTS: Record<string, string> = {
  MAT: `Generate mathematics graph questions suitable for the NBT MAT (Mathematics) section.
Focus on: linear functions, quadratic functions, exponential growth/decay, hyperbolas, and trigonometric concepts.
These should test mathematical reasoning and algebraic manipulation skills.`,

  QL: `Generate quantitative literacy graph questions suitable for the NBT QL (Quantitative Literacy) section.
Focus on: bar charts, pie charts, line graphs showing real-world data (population, economics, statistics).
Questions should involve reading data, calculating percentages, ratios, and making comparisons.
Use practical contexts like household budgets, population data, sports statistics, or economic trends.`,

  AQL: `Generate academic literacy graph questions suitable for the NBT AQL (Academic Literacy) section.
Focus on: interpreting infographics, understanding data presented in tables and charts within academic contexts.
Questions should test the ability to draw conclusions from data, identify trends, and critically evaluate information presented visually.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { numQuestions = 5, topic, difficulty = "medium", nbtSection } = await req.json();

    const topicHint = topic ? `Focus on: ${topic}.` : "Mix different function types.";
    const difficultyPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium;
    const nbtHint = nbtSection && NBT_SECTION_PROMPTS[nbtSection] ? NBT_SECTION_PROMPTS[nbtSection] : "";

    const isDataInterpretation = nbtSection === 'QL' || nbtSection === 'AQL';

    // Calculate how many graphs we need (5 questions per graph)
    const numGraphs = Math.ceil(numQuestions / 5);
    const questionsPerGraph = 5;

    const systemPrompt = isDataInterpretation
      ? `You are a teacher creating data interpretation questions for the NBT ${nbtSection} section.

${nbtHint}

${difficultyPrompt}

${topicHint}

IMPORTANT STRUCTURE: Generate exactly ${numGraphs} graph scenarios. Each graph scenario must have exactly ${questionsPerGraph} sub-questions.
Multiple questions will share the SAME graph/chart. Each graph scenario should have a DIFFERENT dataset and context.

Each graph scenario needs:
- A title describing the data scenario (e.g., "Monthly Sales Revenue 2024")
- Graph data as a chart with labels and datasets
- Exactly ${questionsPerGraph} sub-questions with answer AND calculation (step-by-step working)

For graphData, return:
- "labels": an array of category labels (e.g., ["Jan", "Feb", "Mar", "Apr", "May"])
- "datasets": an array with one object containing "label" (string) and "data" (array of numbers matching labels)
- "title": a descriptive chart title

Example graphData:
{
  "title": "Monthly Sales (R thousands)",
  "labels": ["January", "February", "March", "April", "May"],
  "datasets": [{"label": "Sales", "data": [45, 32, 67, 51, 89]}]
}

For sub-questions, ask about: reading specific values, calculating totals, percentages, differences, averages, trends, comparisons, and ratios. Each sub-question answer must be a SHORT string (a number, percentage, or brief phrase).

CRITICAL RULE FOR ANSWER OPTIONS: Each sub-question must have UNIQUE answer options that are different from all other sub-questions in the same graph scenario. Do NOT reuse the same set of options across different sub-questions. Vary the numerical values, phrasings, and plausible distractors for each question. The correct answer for each question must also be different from the correct answers of other questions in the same graph.

Return ONLY a valid JSON object with a "graphs" array. Each graph object has:
- "id": number
- "title": string
- "graphData": object with "labels", "datasets", and "title"
- "subQuestions": array of exactly ${questionsPerGraph} objects with "question", "answer", "calculation" fields

Do not include any other text or markdown, just the JSON object.`
      : `You are a mathematics teacher creating graph questions. Generate exactly ${numGraphs} graph scenarios.

${nbtHint}

${difficultyPrompt}

IMPORTANT STRUCTURE: Each graph scenario must have exactly ${questionsPerGraph} sub-questions.
Multiple questions will share the SAME graph. Each graph scenario should use DIFFERENT functions.

Each graph scenario needs:
- A title
- Graph data with functions, optional points, optional shapes
- Exactly ${questionsPerGraph} sub-questions with answer AND calculation (step-by-step working/memo)

${topicHint}

Use x range -10 to 10, y range -10 to 10. Variety in function types.

Function types available:
- linear: y = mx + c (provide m, c)
- quadratic: y = ax² + bx + c (provide a, b, c)
- hyperbola: y = a/(x − h) + k (provide a, h, k)
- cubic: y = ax³ + bx² + cx + d (provide a, b, c, d)
- exponential: y = a·baseˣ + c (provide a, base, c)
- absolute: y = a|x − h| + k (provide a, h, k)
- sqrt: y = a√(x − h) + k (provide a, h, k)

For the "calculation" field: show the FULL step-by-step working like a memo/solution.

Return ONLY a valid JSON object with a "graphs" array. Each graph object has:
- "id": number
- "title": string
- "graphData": object with "functions" array, "points" array, "shapes" array, "config" object
- "subQuestions": array of exactly ${questionsPerGraph} objects with "question", "answer", "calculation" fields

Do not include any other text or markdown, just the JSON object.`;

    const userPrompt = `Generate ${numGraphs} graph scenarios with ${questionsPerGraph} questions each (${numQuestions} total questions) at ${difficulty} difficulty.${nbtSection ? ` These are for the NBT ${nbtSection} section.` : ''}`;

    console.log(`[generate-graph-questions] Generating ${numGraphs} graphs × ${questionsPerGraph} questions = ${numQuestions} total, ${difficulty}${nbtSection ? ` for NBT ${nbtSection}` : ''}`);
    
    const result = await callGeminiWithFallback(systemPrompt, userPrompt, {
      temperature: 0.7,
      jsonMode: true,
    });

    const parsed = parseJsonResponse(result.content);
    // Support both "graphs" and "questions" keys for backward compat
    const graphs = parsed.graphs || parsed.questions || parsed;

    const usage = {
      prompt: result.inputTokens,
      completion: result.outputTokens,
      total: result.inputTokens + result.outputTokens,
    };

    return new Response(JSON.stringify({ graphs, usage, model: result.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
