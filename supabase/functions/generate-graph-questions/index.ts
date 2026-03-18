import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { callGeminiWithFallback, parseJsonResponse } from "../_shared/gemini-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// One rich graph supports up to 10 questions. For 15-20 questions, generate 2 graphs.
const QUESTIONS_PER_GRAPH = 10;

const DIFFICULTY_CONFIG: Record<string, { label: string; mathPrompt: string; dataPrompt: string }> = {
  easy: {
    label: 'EASY',
    mathPrompt: `EASY difficulty — questions must only require reading values directly from the graph. No calculations.
Question types allowed:
- "What is the y-intercept of f?"
- "At what x-value does g cross the x-axis?"
- "What is the value of f(3)?"
- "Which function has a positive gradient?"
- "Between which two x-values is f(x) > 0?"
Answers are always directly readable from the graph. Wrong answer options (distractors) must be nearby values that look plausible (e.g. if answer is 4, distractors could be 2, 6, -4).`,
    dataPrompt: `EASY difficulty — questions only require reading values directly from the chart. No calculations.
Question types allowed:
- "What was the value in [month]?"
- "Which category had the highest value?"
- "In which month did [dataset] reach its lowest point?"
- "How many more units did X have than Y in [period]?"
Distractors must be other actual values from the chart, not random numbers — this makes them genuinely tricky.`,
  },
  medium: {
    label: 'MEDIUM',
    mathPrompt: `MEDIUM difficulty — questions require calculations and multi-step reasoning.
Question types required:
- Calculate gradient between two labelled points: m = (y2-y1)/(x2-x1)
- Find midpoint of a segment: M = ((x1+x2)/2, (y1+y2)/2)
- Find x-intercepts by setting y=0 and solving
- Find the equation of a line through two given points
- Find intersection x-value of two functions by setting them equal
- Calculate distance between two labelled points
Each question MUST include a "calculation" field with full step-by-step working.
Distractors must be results of common errors (e.g. dividing instead of multiplying, wrong sign, forgetting to halve for midpoint).`,
    dataPrompt: `MEDIUM difficulty — questions require calculations from chart data.
Question types required:
- Calculate percentage increase/decrease between two periods
- Find the average (mean) across multiple data points
- Calculate ratio between two categories
- Find what percentage one value is of the total
- Calculate the difference between two datasets at a given point
Each question MUST include a "calculation" field showing full working.
Distractors must be results of common errors (e.g. using wrong base for percentage, forgetting to multiply by 100, rounding differently).`,
  },
  hard: {
    label: 'HARD',
    mathPrompt: `HARD difficulty — questions require deep algebraic reasoning and multi-step proof.
Question types required:
- For what values of x is f(x) > g(x)? (solve inequality, show critical points)
- Find the equation of the tangent to f at a given x-value
- Determine the range of f given its domain
- Find the area of the region enclosed between two functions
- Prove algebraically that two functions intersect at a specific point
- Determine the transformation that maps f onto g
- Find the axis of symmetry and turning point of a quadratic
Every question MUST include a detailed "calculation" field with ALL algebraic steps, substitutions, and reasoning.
Distractors must be algebraically plausible wrong answers (e.g. correct method but wrong sign, incomplete factorisation, forgot to consider both roots).`,
    dataPrompt: `HARD difficulty — questions require multi-step analysis and interpretation of trends.
Question types required:
- Calculate compound percentage change over multiple periods
- Determine which dataset grew at a faster rate and by how much (as a %)
- Find the period where the rate of change was greatest and calculate it
- Project a future value based on average growth rate
- Compare two datasets and determine when they will intersect if trends continue
- Calculate weighted averages across multiple categories
Every question MUST include a detailed "calculation" field showing all steps.
Distractors must be results of plausible errors (e.g. using simple instead of compound growth, wrong time period, forgetting to convert units).`,
  },
};

const NBT_CONTEXT: Record<string, string> = {
  MAT: `These are NBT MAT (Mathematics) questions. Use pure mathematical functions: linears, quadratics, hyperbolae, exponentials, cubics. No real-world context needed.`,
  QL: `These are NBT QL (Quantitative Literacy) questions. Use real-world South African contexts: household budgets, taxi fares, electricity costs, food prices, school enrollment data, unemployment rates. Charts must feel authentic and relatable.`,
  AQL: `These are NBT AQL (Academic Literacy) questions. Use academic/research contexts: university enrollment trends, research publication rates, literacy statistics, environmental data. Charts should reflect data a student would encounter in academic reading.`,
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

    const { numQuestions = 5, topic, difficulty = 'medium', nbtSection } = await req.json();

    // Cap total at 20, 1 graph per 10 questions
    const safeNum = Math.min(Math.max(numQuestions, 1), 20);
    const numGraphs = Math.ceil(safeNum / QUESTIONS_PER_GRAPH);
    const questionsPerGraph = Math.ceil(safeNum / numGraphs);

    const diff = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
    const isDataInterpretation = nbtSection === 'QL' || nbtSection === 'AQL';
    const nbtContext = nbtSection ? (NBT_CONTEXT[nbtSection] || '') : '';
    const topicHint = topic ? `\nSpecific topic focus: ${topic}.` : '';

    const systemPrompt = isDataInterpretation
      ? buildDataPrompt(diff, nbtContext, topicHint, numGraphs, questionsPerGraph)
      : buildMathPrompt(diff, nbtContext, topicHint, numGraphs, questionsPerGraph);

    const userPrompt = `Generate ${numGraphs} graph scenario(s) with exactly ${questionsPerGraph} questions each (${safeNum} total) at ${diff.label} difficulty.${nbtSection ? ` NBT ${nbtSection} section.` : ''
      }${topicHint}`;

    console.log(`[generate-graph-questions] ${numGraphs} graph(s) x ${questionsPerGraph} questions = ${safeNum} total | difficulty: ${difficulty} | nbtSection: ${nbtSection || 'math'}`);

    const result = await callGeminiWithFallback(systemPrompt, userPrompt, {
      temperature: 0.8,
      maxOutputTokens: 20000,
      jsonMode: true,
    });

    const parsed = parseJsonResponse(result.content);
    const graphs = parsed.graphs || parsed.questions || parsed;

    return new Response(JSON.stringify({
      graphs,
      usage: {
        prompt: result.inputTokens,
        completion: result.outputTokens,
        total: result.inputTokens + result.outputTokens,
      },
      model: result.model,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildMathPrompt(diff: typeof DIFFICULTY_CONFIG['easy'], nbtContext: string, topicHint: string, numGraphs: number, questionsPerGraph: number): string {
  return `You are an expert South African mathematics teacher creating rigorous graph-based exam questions.

${nbtContext}${topicHint}

${diff.mathPrompt}

GRAPH RICHNESS REQUIREMENTS — every graph MUST include:
- At least 2 functions plotted together (e.g. a quadratic AND a linear, or a hyperbola AND a linear)
- At least 3 labelled key points (intercepts, intersections, turning points) with exact coordinates
- A variety of function types across the ${numGraphs} graph(s)
- Meaningful intersections between the functions that questions can be asked about

Function types to mix:
- linear: { type: "linear", m: number, c: number, label: "f" }
- quadratic: { type: "quadratic", a: number, b: number, c: number, label: "g" }
- hyperbola: { type: "hyperbola", a: number, h: number, k: number, label: "h" }
- exponential: { type: "exponential", a: number, base: number, c: number, label: "p" }
- cubic: { type: "cubic", a: number, b: number, c: number, d: number, label: "f" }

Use x range -8 to 8, y range -10 to 10 unless functions require otherwise.

MULTIPLE CHOICE RULES — CRITICAL:
- Every subQuestion MUST have an "options" array with exactly 4 items: ["A) ...", "B) ...", "C) ...", "D) ..."]
- The correct answer must appear in "options" and "answer" must be one of A/B/C/D indicating which option is correct
- Distractors must be calculated plausible wrong answers, NOT random numbers
- Each question must have COMPLETELY DIFFERENT options from every other question in the same graph
- Rotate which position (A/B/C/D) the correct answer appears in — don't always put it in position A or C
- The question text must be specific and unambiguous

Return ONLY a valid JSON object:
{
  "graphs": [
    {
      "id": 1,
      "title": "string — descriptive title of the graph scenario",
      "graphData": {
        "functions": [
          { "type": "linear", "m": 2, "c": -3, "label": "f", "color": "#6366f1" },
          { "type": "quadratic", "a": -1, "b": 2, "c": 3, "label": "g", "color": "#10b981" }
        ],
        "points": [
          { "x": 3, "y": 3, "label": "A(3; 3)", "description": "Intersection of f and g" },
          { "x": -1, "y": 4, "label": "B(-1; 4)", "description": "y-intercept of g" }
        ],
        "config": { "xMin": -8, "xMax": 8, "yMin": -10, "yMax": 10, "gridLines": true }
      },
      "subQuestions": [
        {
          "question": "What is the y-intercept of f?",
          "options": ["A) -3", "B) 2", "C) 3", "D) -2"],
          "answer": "A",
          "calculation": "f(x) = 2x - 3. At x = 0: f(0) = 2(0) - 3 = -3",
          "explanation": "Substitute x = 0 into f(x) = 2x - 3"
        }
      ]
    }
  ]
}

Generate exactly ${numGraphs} graph(s) with exactly ${questionsPerGraph} subQuestions each. Do not include any text outside the JSON.`;
}

function buildDataPrompt(diff: typeof DIFFICULTY_CONFIG['easy'], nbtContext: string, topicHint: string, numGraphs: number, questionsPerGraph: number): string {
  return `You are an expert South African educator creating data interpretation questions for exam practice.

${nbtContext}${topicHint}

${diff.dataPrompt}

CHART RICHNESS REQUIREMENTS — every chart MUST include:
- At least 2 datasets (e.g. two years, two categories, two groups) so comparative questions are possible
- At least 6 data points per dataset (months, categories, age groups, etc.)
- Realistic South African values and contexts (use Rands, South African cities, local contexts)
- Rich enough data that ${questionsPerGraph} genuinely different questions can be asked about it
- Varied values — not all similar numbers, include peaks, troughs, and interesting trends

Example rich contexts:
- Monthly household income vs expenditure over 12 months (two line datasets)
- School enrollment by grade vs pass rate for two consecutive years (grouped bar)
- Electricity usage by season vs solar generation for a household (two bars)
- Unemployment rate by province for two years side by side

MULTIPLE CHOICE RULES — CRITICAL:
- Every subQuestion MUST have an "options" array with exactly 4 items: ["A) ...", "B) ...", "C) ...", "D) ..."]
- The correct answer must appear in "options" and "answer" must be A, B, C or D
- Distractors must be calculated values from plausible errors — NOT random numbers
- Each question must have COMPLETELY DIFFERENT options and a DIFFERENT correct answer position from every other question
- Rotate which position (A/B/C/D) holds the correct answer across questions
- Question types must vary — do not ask two questions of the same type on one graph

graphData format:
{
  "title": "descriptive chart title",
  "labels": ["Jan", "Feb", "Mar", ...],
  "datasets": [
    { "label": "Income (R)", "data": [12000, 13500, 11800, ...], "color": "#6366f1" },
    { "label": "Expenses (R)", "data": [10200, 12800, 11200, ...], "color": "#10b981" }
  ]
}

Return ONLY a valid JSON object:
{
  "graphs": [
    {
      "id": 1,
      "title": "string",
      "graphData": { "title": "string", "labels": [...], "datasets": [...] },
      "subQuestions": [
        {
          "question": "specific question about the chart data",
          "options": ["A) value1", "B) value2", "C) value3", "D) value4"],
          "answer": "B",
          "calculation": "step-by-step working showing how to get the answer",
          "explanation": "brief plain-English explanation of the method"
        }
      ]
    }
  ]
}

Generate exactly ${numGraphs} graph(s) with exactly ${questionsPerGraph} subQuestions each. Do not include any text outside the JSON.`;
}