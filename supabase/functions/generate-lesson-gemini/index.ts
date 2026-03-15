const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite-preview-09-2025',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

const PRO_FALLBACK_MODELS = [
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  usePro?: boolean;
  jsonMode?: boolean;
}

export async function callGeminiWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResponse> {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const { temperature = 0.5, maxOutputTokens = 65536, usePro = false, jsonMode = false } = options;
  const models = usePro ? PRO_FALLBACK_MODELS : FALLBACK_MODELS;
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[Gemini Fallback] Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

      const generationConfig: Record<string, unknown> = {
        temperature,
        maxOutputTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      };
      if (model.includes('2.5') || model.includes('3')) {
        generationConfig.thinkingConfig = { thinkingBudget: 2048 };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (response.status === 429 || response.status === 503) {
        const errorText = await response.text();
        console.warn(`[Gemini Fallback] ${model} rate limited (${response.status}), trying next...`);
        lastError = new Error(`${model}: ${response.status} - ${errorText}`);
        await sleep(500);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404 || response.status === 400 || response.status === 402) {
          console.warn(`[Gemini Fallback] ${model} unavailable (${response.status}), trying next...`);
          lastError = new Error(`${model}: ${response.status} - ${errorText}`);
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      let text = '';
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].text && !parts[i].thought) { text = parts[i].text; break; }
      }
      if (!text && parts.length > 0) text = parts[parts.length - 1].text || '';
      if (!text) {
        console.warn(`[Gemini Fallback] ${model} returned empty response, trying next...`);
        lastError = new Error(`${model}: Empty response`);
        continue;
      }

      const usageMetadata = data.usageMetadata || {};
      console.log(`[Gemini Fallback] Success with ${model}`);
      return {
        content: text,
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Gemini Fallback] ${model} failed:`, lastError.message);
      continue;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}