import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive list of common South African and International subjects from CAPS, IEB, and Cambridge
const ALL_SUBJECTS = [
  // CAPS & IEB Core
  "Mathematics", "Mathematical Literacy", "Physical Sciences", "Life Sciences", "Accounting",
  "Business Studies", "Economics", "Geography", "History", "English Home Language",
  "English First Additional Language", "English Second Additional Language", "Afrikaans Home Language", "Afrikaans First Additional Language", "Afrikaans Second Additional Language",
  "isiZulu Home Language", "isiZulu First Additional Language", "isiZulu Second Additional Language", "isiXhosa Home Language",
  "isiXhosa First Additional Language", "isiXhosa Second Additional Language", "Sesotho Home Language", "Sesotho First Additional Language", "Sesotho Second Additional Language",
  "Setswana Home Language", "Setswana First Additional Language", "Setswana Second Additional Language",
  "Sepedi Home Language", "Sepedi First Additional Language", "Sepedi Second Additional Language",
  "Xitsonga Home Language", "Xitsonga First Additional Language", "Xitsonga Second Additional Language",
  "SiSwati Home Language", "SiSwati First Additional Language", "SiSwati Second Additional Language",
  "Tshivenda Home Language", "Tshivenda First Additional Language", "Tshivenda Second Additional Language",
  "isiNdebele Home Language", "isiNdebele First Additional Language", "isiNdebele Second Additional Language",
  "Computer Applications Technology", "Information Technology", "Engineering Graphics and Design",
  "Technical Mathematics", "Technical Sciences", "Civil Technology", "Electrical Technology", "Mechanical Technology",
  "Tourism", "Hospitality Studies", "Consumer Studies", "Agricultural Sciences", "Agricultural Technology",
  "Visual Arts", "Design", "Dramatic Arts", "Music", "Dance Studies", "Religion Studies",
  "Economic and Management Sciences", "Natural Sciences", "Social Sciences", "Technology", "Life Orientation",

  // IEB Specific
  "Advanced Programme Mathematics", "Advanced Programme English", "Advanced Programme Physics",
  "Earth Sciences", "Marine Sciences", "Life Sciences Extended Modules",

  // Cambridge Specific
  "English First Language", "English as a Second Language", "Mathematics (Extended)",
  "Additional Mathematics", "Further Mathematics", "Biology", "Chemistry", "Physics",
  "Combined Science", "Coordinated Science", "Environmental Management", "Environmental Science",
  "Sociology", "Psychology", "Global Perspectives", "Global Perspectives and Research",
  "Business", "Law", "Philosophy", "Politics", "Computer Science",
  "Information and Communication Technology", "Media Studies", "Travel and Tourism",
  "Food and Nutrition", "Physical Education", "Thinking Skills"
];

async function callGeminiMultimodal(base64Image: string, mimeType: string, filename: string): Promise<string> {
  // Use Gemini 2.0 Flash as requested for better accuracy
  const model = 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const systemPrompt = `You are a highly accurate AI that analyses South African school documents (PDF first page rendered as an image) AND their filenames to extract metadata.

Your goal is to extract EXACT and ACCURATE metadata to eliminate errors in the database.

Your primary sources of information are:
1. The text and visual content of the provided image (the first page of the document).
2. The provided filename of the PDF.

IMPORTANT - Watermarks & Errors:
- If a watermark is detected (e.g., "testpapers.co.za", "sapapers.co.za", "ecexams.co.za", "stanmorephysics.com"), return:
  { "has_watermark": true, "watermark_text": "<detected watermark>" }
- If "answer book" or "answer sheet" is detected in the filename or heading, return:
  { "error": "Answer book detected" }
- If the document is clearly NOT a school paper (e.g., a textbook chapter, a personal letter, etc.), return:
  { "error": "Not a valid school document" }

Rules for metadata extraction:
- Curriculum:
  * "IEB": Independent Examinations Board. Usually explicitly stated.
  * "CAPS": National Senior Certificate (NSC) or Senior Certificate (SC). This is the default South African curriculum. Often has "DBE" (Department of Basic Education) on it.
  * "Cambridge": Look for "IGCSE", "AS Level", "A Level".
- Document Type:
  * If "Examination Guidelines" or "Guidelines" is detected, set "is_past_paper" to false and include "Examination Guidelines" in "description".
  * If "Diagnostic Report" is detected, set "is_past_paper" to false and include "Diagnostic Report" in "description".
- Terminology: "SAL" = "Second Additional Language", "HL" = "Home Language", "FAL" = "First Additional Language".
- Subject Normalization:
  * "Physical Science" -> "Physical Sciences"
  * "Maths" -> "Mathematics"
  * "Life Science" -> "Life Sciences"
  * "Agricultural Science" -> "Agricultural Sciences"
  * "Math Lit" -> "Mathematical Literacy"
- Province Identification: Differentiate papers by province using keywords in the filename or heading.
  * GDE / GP / JHB / GAU: Gauteng
  * WC / CT: Western Cape
  * KZN / DUR: KwaZulu-Natal
  * EC / PE: Eastern Cape
  * FS / BLO: Free State
  * LP / POL: Limpopo
  * MP / NEL: Mpumalanga
  * NC / KIM: Northern Cape
  * NW / MAF: North West
  If a province is identified, return it in the "province" field and include it in the "description" (e.g., "Gauteng Version").
- is_memo: Look for "Memo", "Memorandum", "Marking Guideline", "M", or "possible answers" or "MG or mg or Mg".
- paper_number: Identify the paper number (P1, P2, P3). Return just the integer (1, 2, or 3).
- grade: Return as integer (1-12).
- year: Return as 4-digit integer (e.g., 2024).
- subject: MUST match one of the subjects in the provided list or be the most accurate name. If it's a language, specify the level (e.g. "English Home Language").
- month: Return ONLY the 3-letter acronym: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec.
  * If it says "Nov/Dec", return "Nov".
  * If it says "Feb/Mar", return "Feb".
  * "Supplementary" often means "Feb".
  * "Trial" often means "Sep".
  * "June" or "Mid-year" means "Jun".
- language: Main language (e.g., "English", "Afrikaans").

List of valid subjects to prefer:
${ALL_SUBJECTS.join(", ")}

Return JSON ONLY. Do not include explanations.

Output schema:
{
  "subject": string | null,
  "curriculum": "CAPS" | "IEB" | "Cambridge" | null,
  "grade": number | null,
  "year": number | null,
  "paper_number": number | null,
  "month": "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec" | null,
  "language": string | null,
  "province": string | null,
  "description": string | null,
  "is_past_paper": boolean,
  "is_memo": boolean,
  "has_watermark": boolean,
  "watermark_text": string | null
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Filename: ${filename}\n\n${systemPrompt}` },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error: ${response.status} - ${errorText}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { image, filename, mime_type = 'image/jpeg' } = await req.json();
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'Image data is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    console.log(`Calling Gemini 2.0 Flash for: ${filename}`);
    const generatedContent = await callGeminiMultimodal(image, mime_type, filename || 'Unknown');
    console.log('Gemini response received');

    let cleanContent = generatedContent.trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);

    try {
      const parsed = JSON.parse(cleanContent.trim());

      // If Gemini detected an error (like an answer book), return it as a 400 error
      if (parsed.error) {
        return new Response(JSON.stringify({ error: parsed.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data: parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', generatedContent);
      return new Response(JSON.stringify({ error: 'Failed to parse generated content', raw: generatedContent }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Analyze paper metadata error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
