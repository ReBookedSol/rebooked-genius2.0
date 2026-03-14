/**
 * Shared Gemini API caller with model fallback chain.
 */

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

const PRO_FALLBACK_MODELS = [
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
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
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured');
  }

  const { temperature = 0.5, maxOutputTokens = 65536, usePro = false, jsonMode = false } = options;
  const models = usePro ? PRO_FALLBACK_MODELS : FALLBACK_MODELS;

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      console.log(`[Gemini Fallback] Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            // For thinking models (2.5+), set thinking budget so it doesn't consume output tokens
            ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 2048 } } : {}),
          },
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
        console.warn(`[Gemini Fallback] ${model} rate limited (${response.status}), trying next model...`);
        lastError = new Error(`${model}: ${response.status} - ${errorText}`);
        await sleep(500);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404 || response.status === 400) {
          console.warn(`[Gemini Fallback] ${model} unavailable (${response.status}), trying next...`);
          lastError = new Error(`${model}: ${response.status} - ${errorText}`);
          continue;
        }
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      // For thinking models (2.5+), the response may have multiple parts:
      // parts[0] = thinking/reasoning, parts[last] = actual output
      const parts = data.candidates?.[0]?.content?.parts || [];
      // Get the last text part (skip thought parts which have "thought" field)
      let text = '';
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].text && !parts[i].thought) {
          text = parts[i].text;
          break;
        }
      }
      // Fallback: if all parts have "thought", just take the last part's text
      if (!text && parts.length > 0) {
        text = parts[parts.length - 1].text || '';
      }
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

/**
 * Robust JSON parser that handles common AI output issues:
 * - Markdown code blocks
 * - Bad escape characters
 * - Truncated JSON
 * - Trailing commas
 */
export function parseJsonResponse(raw: string): any {
  let clean = raw.trim();
  
  // Strip markdown code blocks more aggressively - handle all variations
  clean = clean
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  
  // Replace ALL control characters with spaces (safe for both JSON structure and string values)
  clean = clean.replace(/[\x00-\x1F\x7F]/g, ' ');

  // Find JSON boundaries
  const jsonStart = clean.search(/[\{\[]/);
  if (jsonStart === -1) {
    throw new Error(`No JSON found in response. First 200 chars: ${raw.substring(0, 200)}`);
  }
  
  const startChar = clean[jsonStart];
  const endChar = startChar === '[' ? ']' : '}';
  let jsonEnd = clean.lastIndexOf(endChar);

  // If no proper end found, take everything from start
  if (jsonEnd > jsonStart) {
    clean = clean.substring(jsonStart, jsonEnd + 1);
  } else {
    clean = clean.substring(jsonStart);
  }

  // First attempt: direct parse
  try {
    return JSON.parse(clean);
  } catch (_firstError) {
    console.log('[parseJsonResponse] Direct parse failed, attempting recovery...');
  }

  // Fix common issues
  let fixed = clean
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\\'/g, "'")
    .replace(/\\([^"\\\/bfnrtu])/g, '$1')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']');

  try {
    return JSON.parse(fixed);
  } catch (_secondError) {
    console.log('[parseJsonResponse] Second parse failed, attempting truncation recovery...');
  }

  // Check if we're inside an unclosed string and try to recover
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  
  for (const ch of fixed) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
  }

  // If we're inside a string, truncate to last complete structure
  if (inString || braceCount > 0 || bracketCount > 0) {
    // Find the last complete object by looking for "}," or "}]"
    const patterns = [/\}\s*,\s*\{/g, /\}\s*\]/g, /\}\s*,/g];
    let lastGoodPos = -1;
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(fixed)) !== null) {
        const pos = match.index + 1; // Position after the }
        if (pos > lastGoodPos) {
          lastGoodPos = pos;
        }
      }
    }
    
    if (lastGoodPos > fixed.length * 0.2) {
      fixed = fixed.substring(0, lastGoodPos);
      console.log(`[parseJsonResponse] Truncated to position ${lastGoodPos}`);
      
      // Recount brackets
      braceCount = 0; bracketCount = 0; inString = false; escaped = false;
      for (const ch of fixed) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') braceCount++;
        else if (ch === '}') braceCount--;
        else if (ch === '[') bracketCount++;
        else if (ch === ']') bracketCount--;
      }
    }
  }

  // Remove any trailing commas
  fixed = fixed.replace(/,\s*$/g, '').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  
  // Close unclosed structures
  for (let i = 0; i < braceCount; i++) fixed += '}';
  for (let i = 0; i < bracketCount; i++) fixed += ']';

  try {
    const result = JSON.parse(fixed);
    console.log(`[parseJsonResponse] Recovered truncated JSON successfully`);
    return result;
  } catch (thirdError) {
    console.log(`[parseJsonResponse] Third attempt failed: ${thirdError}`);
  }

  // Last resort: try to extract just the questions array
  const questionsMatch = fixed.match(/"questions"\s*:\s*\[/);
  if (questionsMatch) {
    const arrayStart = fixed.indexOf('[', questionsMatch.index);
    if (arrayStart > 0) {
      let depth = 0;
      let lastCompleteItem = -1;
      let inStr = false;
      let esc = false;
      
      for (let i = arrayStart; i < fixed.length; i++) {
        const ch = fixed[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) lastCompleteItem = i + 1;
        }
      }
      
      if (lastCompleteItem > arrayStart) {
        let questionsJson = fixed.substring(arrayStart, lastCompleteItem);
        questionsJson = questionsJson.replace(/,\s*$/g, '') + ']';
        
        try {
          const questions = JSON.parse(questionsJson);
          console.log(`[parseJsonResponse] Extracted ${questions.length} questions via last-resort method`);
          return { questions };
        } catch (_) { /* continue to throw */ }
      }
    }
  }

  throw new Error(`Failed to parse JSON response. First 200 chars: ${raw.substring(0, 200)}`);
}