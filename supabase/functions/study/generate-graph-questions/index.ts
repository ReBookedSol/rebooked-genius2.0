import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { numQuestions = 5, topic, difficulty = "medium" } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const topicHint = topic ? `Focus on: ${topic}.` : "Mix different function types.";
    const difficultyPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium;

    const systemPrompt = `You are a mathematics teacher creating graph questions. Generate exactly ${numQuestions} questions.

IMPORTANT: You MUST respond by calling the "return_questions" tool. Do NOT return plain text.

${difficultyPrompt}

Each question needs:
- A title
- Graph data with functions, optional points, optional shapes
- 3-5 sub-questions with answer AND calculation (step-by-step working/memo)

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

For the "calculation" field: show the FULL step-by-step working like a memo/solution. Use mathematical notation. For example:
"m = (y₂ - y₁)/(x₂ - x₁)\\nm = (4 - 2)/(3 - 1)\\nm = 2/2\\nm = 1"`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: `Generate ${numQuestions} ${difficulty} graph questions now.` }
            ]
          }
        ],
        tools: [
          {
            function_declarations: [
              {
                name: "return_questions",
                description: "Return the generated graph questions",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number" },
                          title: { type: "string" },
                          graphData: {
                            type: "object",
                            properties: {
                              functions: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "string" },
                                    label: { type: "string" },
                                    type: { type: "string", enum: ["linear", "quadratic", "hyperbola", "cubic", "exponential", "absolute", "sqrt"] },
                                    m: { type: "number" },
                                    c: { type: "number" },
                                    a: { type: "number" },
                                    b: { type: "number" },
                                    d: { type: "number" },
                                    h: { type: "number" },
                                    k: { type: "number" },
                                    base: { type: "number" },
                                    color: { type: "string" },
                                  },
                                  required: ["id", "label", "type", "color"],
                                },
                              },
                              points: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "string" },
                                    x: { type: "number" },
                                    y: { type: "number" },
                                    label: { type: "string" },
                                  },
                                  required: ["id", "x", "y"],
                                },
                              },
                              shapes: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "string" },
                                    type: { type: "string", enum: ["triangle", "rectangle", "polygon"] },
                                    vertices: {
                                      type: "array",
                                      items: {
                                        type: "object",
                                        properties: { x: { type: "number" }, y: { type: "number" } },
                                        required: ["x", "y"],
                                      },
                                    },
                                    color: { type: "string" },
                                  },
                                  required: ["id", "type", "vertices", "color"],
                                },
                              },
                              config: {
                                type: "object",
                                properties: {
                                  xMin: { type: "number" },
                                  xMax: { type: "number" },
                                  yMin: { type: "number" },
                                  yMax: { type: "number" },
                                  step: { type: "number" },
                                },
                                required: ["xMin", "xMax", "yMin", "yMax", "step"],
                              },
                            },
                            required: ["functions", "points", "shapes", "config"],
                          },
                          subQuestions: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                question: { type: "string" },
                                answer: { type: "string" },
                                calculation: { type: "string" },
                              },
                              required: ["question", "answer"],
                            },
                          },
                        },
                        required: ["id", "title", "graphData", "subQuestions"],
                      },
                    },
                  },
                  required: ["questions"],
                },
              },
            ],
          }
        ],
        tool_config: {
          function_calling_config: {
            mode: "ANY",
            allowed_function_names: ["return_questions"]
          }
        }
      }),
    });

    if (!response.ok) {
      const statusCode = response.status;
      if (statusCode === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", statusCode, text);
      throw new Error("Gemini API error");
    }

    const result = await response.json();
    const toolCall = result.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    if (!toolCall) throw new Error("No tool call in response");

    const questions = toolCall.args;

    const usage = result.usageMetadata ? {
      prompt: result.usageMetadata.promptTokenCount || 0,
      completion: result.usageMetadata.candidatesTokenCount || 0,
      total: result.usageMetadata.totalTokenCount || 0,
    } : null;

    return new Response(JSON.stringify({ ...questions, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
