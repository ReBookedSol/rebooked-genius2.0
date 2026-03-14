import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchPdfAsBase64(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  const mimeType = fileUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
  return { base64, mimeType };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(base64Data: string, mimeType: string, filename: string, currentData?: any, maxRetries = 4): Promise<any> {
  const model = 'gemini-2.0-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const systemPrompt = `You are a professional auditor for South African school documents (NSC/CAPS/IEB past papers and memos).
Analyze the provided PDF document and filename to extract EXACT metadata.

CRITICAL RULES:
1. SUBJECT: Match EXACTLY to one of these standard South African subjects: Mathematics, Mathematical Literacy, Physical Sciences, Life Sciences, Accounting, Business Studies, Economics, Geography, History, English Home Language, English First Additional Language, English Second Additional Language, Afrikaans Home Language, Afrikaans First Additional Language, Afrikaans Second Additional Language, isiZulu Home Language, isiZulu First Additional Language, isiZulu Second Additional Language, isiXhosa Home Language, isiXhosa First Additional Language, isiXhosa Second Additional Language, Sesotho Home Language, Sesotho First Additional Language, Sesotho Second Additional Language, Setswana Home Language, Setswana First Additional Language, Setswana Second Additional Language, Sepedi Home Language, Sepedi First Additional Language, Sepedi Second Additional Language, Xitsonga Home Language, Xitsonga First Additional Language, Xitsonga Second Additional Language, SiSwati Home Language, SiSwati First Additional Language, SiSwati Second Additional Language, Tshivenda Home Language, Tshivenda First Additional Language, Tshivenda Second Additional Language, isiNdebele Home Language, isiNdebele First Additional Language, isiNdebele Second Additional Language, Computer Applications Technology, Information Technology, Engineering Graphics and Design, Technical Mathematics, Technical Sciences, Civil Technology, Electrical Technology, Mechanical Technology, Tourism, Hospitality Studies, Consumer Studies, Agricultural Sciences, Agricultural Technology, Visual Arts, Design, Dramatic Arts, Music, Dance Studies, Religion Studies, Life Orientation, Marine Sciences, South African Sign Language Home Language.
2. TYPE: Is it a "Past Paper" (question paper) or a "Memorandum" (marking guideline/answer sheet)?
3. ANNEXURE/ADDENDUM: If the document is an "Annexure" or "Addendum", set is_annexure to true.
4. GRADE: Extract the grade (typically 10, 11, or 12 for NSC). Always a number. If the document says "National Senior Certificate" it is Grade 12.
5. YEAR: The year the exam was written.
6. PAPER NUMBER: Paper 1, 2, or 3.
7. MONTH: The month of the examination session (use 3-letter abbreviation: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec).
8. LANGUAGE: The language the document is written in (English, Afrikaans, etc.).
9. CURRICULUM: CAPS, IEB, or Cambridge.
10. WATERMARKS: Identify any watermarks.
11. MISSING FIELDS: If any field in the current database is null or empty, you MUST extract it from the document content and suggest the correct value. This is critical - grade, year, subject, paper_number, month, and language should NEVER be null for a valid past paper or memo.
12. WRONG SUBJECT: If the subject in the database does not match the actual content of the document, flag it and provide the correct subject name.

Current Database Metadata:
${JSON.stringify(currentData, null, 2)}

You MUST output valid JSON with this exact structure:
{
  "subject": string | null,
  "grade": number | null,
  "year": number | null,
  "paper_number": number | null,
  "month": "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec" | null,
  "language": string | null,
  "curriculum": "CAPS" | "IEB" | "Cambridge" | null,
  "is_memo": boolean,
  "is_past_paper": boolean,
  "is_annexure": boolean,
  "has_watermark": boolean,
  "watermark_text": string | null,
  "confidence_score": number,
  "audit_reasoning": string,
  "fix_suggestion": string,
  "missing_fields": string[]
}

The "missing_fields" array should list any fields that are null/empty in the database but you were able to extract from the document.`;

  const requestBody: any = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Data } },
        { text: `Filename: ${filename}\n\n${systemPrompt}` }
      ]
    }],
    generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    console.log(`Gemini API attempt ${attempt + 1}/${maxRetries + 1}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return JSON.parse(text);
    }

    const errorBody = await response.text();

    // Retry on 429 (rate limit) or 503 (service unavailable)
    if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
      console.warn(`Gemini ${response.status}, retrying in ${Math.round(backoffMs)}ms...`);
      await sleep(backoffMs);
      continue;
    }

    console.error(`Gemini API error ${response.status}:`, errorBody.substring(0, 300));
    throw new Error(`Gemini API error: ${response.status} - ${errorBody.substring(0, 200)}`);
  }

  throw new Error('Gemini API: max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { document_id } = await req.json();

    if (!document_id) {
      return new Response(JSON.stringify({ error: 'Missing document_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*, subjects(name)')
      .eq('id', document_id)
      .single();

    if (fetchError || !doc) throw new Error('Document not found');
    if (!doc.file_url) throw new Error('Document has no file_url');

    console.log(`Auditing document ${document_id}: ${doc.title}`);
    console.log(`Fetching PDF from: ${doc.file_url}`);

    const { base64, mimeType } = await fetchPdfAsBase64(doc.file_url);
    console.log(`PDF fetched, base64 size: ${base64.length}`);

    const aiData = await callGeminiWithRetry(base64, mimeType, doc.title || doc.file_url, {
      title: doc.title,
      year: doc.year,
      grade: doc.grade,
      paper_number: doc.paper_number,
      month: doc.month,
      subject: doc.subjects?.name,
      subject_id: doc.subject_id,
      is_memo: doc.is_memo,
      is_past_paper: doc.is_past_paper,
      language: doc.language,
      curriculum: doc.curriculum,
    });
    console.log('AI Audit completed successfully');

    // Compare and find mismatches + missing fields
    const mismatches: string[] = [];
    const missing_fields: string[] = aiData.missing_fields || [];

    // Detect mismatches
    if (aiData.year && doc.year !== aiData.year) mismatches.push('year');
    if (aiData.grade && doc.grade !== aiData.grade) mismatches.push('grade');
    if (aiData.paper_number && doc.paper_number !== aiData.paper_number) mismatches.push('paper_number');
    if (aiData.month && doc.month !== aiData.month) mismatches.push('month');
    if (aiData.language && doc.language !== aiData.language) mismatches.push('language');
    if (aiData.is_memo !== undefined && aiData.is_memo !== doc.is_memo) mismatches.push('is_memo');
    if (aiData.is_past_paper !== undefined && aiData.is_past_paper !== doc.is_past_paper) mismatches.push('is_past_paper');
    if (aiData.curriculum && doc.curriculum !== aiData.curriculum) mismatches.push('curriculum');

    // Detect missing fields in DB that AI extracted
    if (!doc.grade && aiData.grade) { if (!mismatches.includes('grade')) mismatches.push('grade'); }
    if (!doc.year && aiData.year) { if (!mismatches.includes('year')) mismatches.push('year'); }
    if (!doc.paper_number && aiData.paper_number) { if (!mismatches.includes('paper_number')) mismatches.push('paper_number'); }
    if (!doc.month && aiData.month) { if (!mismatches.includes('month')) mismatches.push('month'); }
    if (!doc.language && aiData.language) { if (!mismatches.includes('language')) mismatches.push('language'); }
    if (!doc.curriculum && aiData.curriculum) { if (!mismatches.includes('curriculum')) mismatches.push('curriculum'); }

    // Subject matching
    let subject_id = doc.subject_id;
    if (aiData.subject && (!doc.subjects || doc.subjects.name !== aiData.subject)) {
      let { data: subMatch } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('name', aiData.subject)
        .limit(1)
        .single();

      if (!subMatch) {
        const { data: fuzzyMatch } = await supabase
          .from('subjects')
          .select('id, name')
          .ilike('name', `%${aiData.subject}%`)
          .limit(1)
          .single();
        subMatch = fuzzyMatch;
      }

      if (subMatch && subMatch.id !== doc.subject_id) {
        mismatches.push('subject');
        subject_id = subMatch.id;
      }
    }

    // Also flag if subject_id is null but AI found a subject
    if (!doc.subject_id && aiData.subject) {
      let { data: subMatch } = await supabase
        .from('subjects')
        .select('id, name')
        .ilike('name', `%${aiData.subject}%`)
        .limit(1)
        .single();
      if (subMatch) {
        if (!mismatches.includes('subject')) mismatches.push('subject');
        subject_id = subMatch.id;
      }
    }

    // Duplicate Detection
    const dupQuery = supabase
      .from('documents')
      .select('id, title')
      .neq('id', document_id)
      .limit(5);

    if (aiData.year) dupQuery.eq('year', aiData.year);
    if (aiData.grade) dupQuery.eq('grade', aiData.grade);
    if (aiData.paper_number) dupQuery.eq('paper_number', aiData.paper_number);
    if (aiData.month) dupQuery.eq('month', aiData.month);
    if (subject_id) dupQuery.eq('subject_id', subject_id);
    if (aiData.language) dupQuery.eq('language', aiData.language);
    dupQuery.eq('is_memo', aiData.is_memo ?? false);

    const { data: duplicates } = await dupQuery;

    // Smart Linking
    let suggested_link = null;
    if (aiData.is_memo && !doc.memo_for_document_id) {
      const linkQuery = supabase
        .from('documents')
        .select('id, title')
        .eq('is_past_paper', true)
        .eq('is_memo', false)
        .limit(1);
      if (aiData.year) linkQuery.eq('year', aiData.year);
      if (aiData.grade) linkQuery.eq('grade', aiData.grade);
      if (aiData.paper_number) linkQuery.eq('paper_number', aiData.paper_number);
      if (aiData.month) linkQuery.eq('month', aiData.month);
      if (subject_id) linkQuery.eq('subject_id', subject_id);
      if (aiData.language) linkQuery.eq('language', aiData.language);

      const { data: paperMatch } = await linkQuery.single();
      if (paperMatch) suggested_link = { type: 'paper', id: paperMatch.id, title: paperMatch.title };
    } else if (!aiData.is_memo && aiData.is_past_paper) {
      const { data: linkedMemo } = await supabase
        .from('documents')
        .select('id')
        .eq('memo_for_document_id', document_id)
        .limit(1);

      if (!linkedMemo || linkedMemo.length === 0) {
        const memoQuery = supabase
          .from('documents')
          .select('id, title')
          .eq('is_memo', true)
          .is('memo_for_document_id', null)
          .limit(1);
        if (aiData.year) memoQuery.eq('year', aiData.year);
        if (aiData.grade) memoQuery.eq('grade', aiData.grade);
        if (aiData.paper_number) memoQuery.eq('paper_number', aiData.paper_number);
        if (aiData.month) memoQuery.eq('month', aiData.month);
        if (subject_id) memoQuery.eq('subject_id', subject_id);
        if (aiData.language) memoQuery.eq('language', aiData.language);

        const { data: memoMatch } = await memoQuery.single();
        if (memoMatch) suggested_link = { type: 'memo', id: memoMatch.id, title: memoMatch.title };
      }
    }

    const report = {
      document_id,
      current_data: {
        title: doc.title, year: doc.year, grade: doc.grade,
        paper_number: doc.paper_number, month: doc.month, language: doc.language,
        subject: doc.subjects?.name, subject_id: doc.subject_id,
        is_memo: doc.is_memo, is_past_paper: doc.is_past_paper,
        memo_for_document_id: doc.memo_for_document_id,
        file_url: doc.file_url, curriculum: doc.curriculum,
      },
      extracted_data: aiData,
      mismatches,
      missing_fields,
      duplicates: duplicates || [],
      suggested_link,
      is_annexure: aiData.is_annexure || doc.title?.toLowerCase().includes('annexure') || doc.title?.toLowerCase().includes('addendum'),
      subject_id_match: subject_id,
      audit_reasoning: aiData.audit_reasoning,
      fix_suggestion: aiData.fix_suggestion
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Audit document error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
