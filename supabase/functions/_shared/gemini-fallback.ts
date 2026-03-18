const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
];

const PRO_FALLBACK_MODELS = [
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-pro-preview',
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
  useThinking?: boolean; // now opt-in, not automatic
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export async function callGeminiWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResponse> {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

  const {
    temperature = 0.5,
    maxOutputTokens = 65536,
    usePro = false,
    jsonMode = false,
    useThinking = false, // default OFF — caller must opt in
  } = options;

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

      // Only add thinking if explicitly requested AND model supports it
      if (useThinking && (model.includes('2.5') || model.includes('3'))) {
        generationConfig.thinkingConfig = { thinkingBudget: 2048 };
      }

      const requestParts: any[] = [{ text: `${systemPrompt}\n\n${userPrompt}` }];
      if (options.inlineData) {
        requestParts.push({
          inlineData: {
            mimeType: options.inlineData.mimeType,
            data: options.inlineData.data,
          },
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: requestParts }],
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
      const responseParts = data.candidates?.[0]?.content?.parts || [];
      let text = '';
      for (let i = responseParts.length - 1; i >= 0; i--) {
        if (responseParts[i].text && !responseParts[i].thought) { text = responseParts[i].text; break; }
      }
      if (!text && responseParts.length > 0) text = responseParts[responseParts.length - 1].text || '';
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

export function parseJsonResponse(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error(`Invalid input to parseJsonResponse: ${typeof raw}`);
  }

  let clean = raw.trim();

  clean = clean
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  const jsonStart = clean.search(/[\{\[]/);
  if (jsonStart === -1) {
    throw new Error(`No JSON found in response. First 200 chars: ${raw.substring(0, 200)}`);
  }

  const startChar = clean[jsonStart];
  const endChar = startChar === '[' ? ']' : '}';
  let jsonEnd = clean.lastIndexOf(endChar);

  if (jsonEnd > jsonStart) {
    clean = clean.substring(jsonStart, jsonEnd + 1);
  } else {
    clean = clean.substring(jsonStart);
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.warn(`[parseJsonResponse] Direct parse failed: ${(e as Error).message}`);
  }

  let fixed = clean
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\\'/g, "'")
    .replace(/\\([^"\\\/bfnrtu])/g, '$1')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/,\s*$/g, '');

  try {
    return JSON.parse(fixed);
  } catch (e) {
    console.warn(`[parseJsonResponse] Fixed parse failed: ${(e as Error).message}`);
  }

  let braceCount = 0, bracketCount = 0, inString = false, escaped = false;
  for (const ch of fixed) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceCount++; else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++; else if (ch === ']') bracketCount--;
  }

  fixed = fixed.replace(/,\s*$/g, '').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  for (let i = 0; i < braceCount; i++) fixed += '}';
  for (let i = 0; i < bracketCount; i++) fixed += ']';

  try {
    return JSON.parse(fixed);
  } catch (e) {
    console.error(`[parseJsonResponse] Final parse failed. Fixed JSON (first 500 chars): ${fixed.substring(0, 500)}`);
    throw new Error(`Failed to parse JSON response. First 200 chars: ${raw.substring(0, 200)}`);
  }
}