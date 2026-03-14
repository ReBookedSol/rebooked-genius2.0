import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(systemPrompt: string, userPrompt: string, tier: string = 'free'): Promise<string> {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 65536 },
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.89.0");
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { type, content, count, language = 'en', message, documentContext, tier = 'free' } = await req.json();
    console.log('Received request:', { type, count, language, tier, contentLength: content?.length, messageLength: message?.length });

    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY not configured');

    let systemPrompt = '';
    let userPrompt = '';
    const isAfrikaans = language === 'af';

    if (type === 'chat') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige studiebegeleier en onderwyser. Jy het toegang tot studiedokumentasie en help studente om die inhoud beter te verstaan.
        Beantwoord vrae gebaseer op die verskafde dokument- en kursusgeleiding.
        Wees spesifiek en prakties in jou antwoorde, en verwys waar moontlik na konsepte uit die dokument.`;
      } else {
        systemPrompt = `You are an expert study guide and educator. You have access to study materials and help students understand the content better.
        Answer questions based on the provided document context and course guidance.
        Be specific and practical in your answers, and reference concepts from the document where possible.`;
      }

      let documentInfo = '';
      if (documentContext) {
        documentInfo = `
        Document Title: ${documentContext.title}
        Summary: ${documentContext.summary || 'No summary available'}
        Key Concepts: ${documentContext.concepts ? documentContext.concepts.join(', ') : 'None'}
        Document Content (excerpt): ${documentContext.content ? documentContext.content.substring(0, 3000) : 'Not available'}
        `;
      }

      userPrompt = `${documentInfo}\n\nStudent Question: ${message}`;
    } else if (type === 'flashcards') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige opvoeder. Genereer flitskaarte vanuit die verskafde inhoud.
        Elke flitskaart moet 'n duidelike vraag (voor) en 'n bondige antwoord (agter) hê.
        Gee SLEGS 'n geldige JSON-skikking van flitskaart-objekte met "front" en "back" eienskappe.
        Moenie enige ander teks of markdown insluit nie, net die JSON-skikking.`;
        userPrompt = `Genereer ${count || 5} flitskaarte vanuit hierdie inhoud:\n\n${content}`;
      } else {
        systemPrompt = `You are an expert educator. Generate flashcards from the provided content.
        Each flashcard should have a clear question (front) and a concise answer (back).
        Return ONLY a valid JSON array of flashcard objects with "front" and "back" properties.
        Do not include any other text or markdown, just the JSON array.`;
        userPrompt = `Generate ${count || 5} flashcards from this content:\n\n${content}`;
      }
    } else if (type === 'quiz') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige opvoeder. Genereer meerkeuse-toetsvrae vanuit die verskafde inhoud.
        Elke vraag moet 4 opsies met een korrekte antwoord hê.
        Gee SLEGS 'n geldige JSON-skikking van vraag-objekte met hierdie eienskappe:
        - "question": die vraagteks
        - "options": skikking van 4 opsie-stringe
        - "correct_answer": die korrekte opsie (moet presies ooreenstem met een van die opsies)
        - "explanation": kort verklaring van waarom dit korrek is
        Moenie enige ander teks of markdown insluit nie, net die JSON-skikking.`;
        userPrompt = `Genereer ${count || 5} toetsvrae vanuit hierdie inhoud:\n\n${content}`;
      } else {
        systemPrompt = `You are an expert educator. Generate multiple choice quiz questions from the provided content.
        Each question should have 4 options with one correct answer.
        Return ONLY a valid JSON array of question objects with these properties:
        - "question": the question text
        - "options": array of 4 option strings
        - "correct_answer": the correct option (must match one of the options exactly)
        - "explanation": brief explanation of why this is correct
        Do not include any other text or markdown, just the JSON array.`;
        userPrompt = `Generate ${count || 5} quiz questions from this content:\n\n${content}`;
      }
    } else if (type === 'ingest_paper') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige in die analise van Suid-Afrikaanse vraestelle.
        Skandeer die verskafde teks en onttrek 'n gestruktureerde voorstelling van alle vrae, subvrae, en hul verwante konteks (soos gevallestudies of algemene instruksies).

        Gee SLEGS 'n geldige JSON-skikking van vraag-objekte met hierdie eienskappe:
        - "question_number": string (b.v. "1.1", "2.1.3")
        - "question_text": string
        - "context": string (enige gevallestudie, diagrambeskrywing, of instruksies wat op hierdie vraag betrekking het)
        - "section": string (b.v. "Afdeling A", "Vraag 2")
        - "topic": string (voorspelde onderwerp of vakgebied)
        - "marks": getal (indien gespesifiseer)

        Maak seker jy vang die hiërargie korrek vas. As 'n gevallestudie op verskeie vrae van toepassing is, sluit dit in die "context" vir elkeen in.
        Moenie enige ander teks of markdown insluit nie, net die JSON-skikking.`;
        userPrompt = `Analiseer hierdie vraestel-inhoud en onttrek alle vrae:\n\n${content}`;
      } else {
        systemPrompt = `You are an expert at analyzing South African past papers.
        Scan the provided text and extract a structured representation of all questions, sub-questions, and their associated context (like case studies or general instructions).

        Return ONLY a valid JSON array of question objects with these properties:
        - "question_number": string (e.g. "1.1", "2.1.3")
        - "question_text": string
        - "context": string (any case study, diagram description, or instructions related to this question)
        - "section": string (e.g. "Section A", "Question 2")
        - "topic": string (predicted topic or subject area)
        - "marks": number (if specified)

        Ensure you capture the hierarchy correctly. If a case study applies to multiple questions, include it in the "context" for each.
        Do not include any other text or markdown, just the JSON array.`;
        userPrompt = `Analyze this past paper content and extract all questions:\n\n${content}`;
      }
    } else if (type === 'summary') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige opvoeder wat spesialiseer in studietegnieke.
        Skep 'n duidelike, gestruktureerde opsomming van die verskafde inhoud wat 'n student kan help om effektief te studeer.
        Gebruik koeëltjies en organiseer volgens sleutelkonsepte.`;
        userPrompt = `Vat hierdie inhoud saam vir studeerdoeleindes:\n\n${content}`;
      } else {
        systemPrompt = `You are an expert educator specializing in study techniques.
        Create a clear, structured summary of the provided content that would help a student study effectively.
        Use bullet points and organize by key concepts.`;
        userPrompt = `Summarize this content for study purposes:\n\n${content}`;
      }
    } else if (type === 'chat_title') {
      systemPrompt = `You are a helpful assistant. Generate a short, descriptive title (max 6 words) that summarizes what this conversation is about. Return ONLY the title text, nothing else.`;
      userPrompt = `Generate a title for this conversation:\n\n${message}`;
    } else if (type === 'blurting') {
      if (isAfrikaans) {
        systemPrompt = `Jy is 'n kundige onderwyskundige wat studente se begrip van studies assesseer.
        Analiseer die student se uitleg teenoor die gegee inhoud en lewer gestruktureerde terugvoering.
        Gee SLEGS 'n geldige JSON-objek met hierdie eienskappe:
        - "recalled_concepts": skikking van korrekt verklaardeide konsepte (minimaal 2-3)
        - "missing_concepts": skikking van konsepte wat nie genoem is nie (minimaal 1-2)
        - "misconceptions": skikking van objekte met "text" (die wanopvatting) en "explanation" (waarom dit verkeerd is)
        - "confidence_score": getal tussen 0 en 1 wat die kwaliteit van die uitleg aandui
        - "suggested_practice_questions": skikking van objekte met "q" (vraag) en "type" (opsommend/meervoudig/kort)
        - "study_recommendations": skikking van aanbevelings vir verder studie
        Wees konstruktief en stimulerend.`;
      } else {
        systemPrompt = `You are an expert educational assessor analyzing a student's spoken explanation (blurting) of course material.
        Analyze the student's transcript against the provided lesson content and deliver structured feedback.
        Return ONLY a valid JSON object with these exact properties:
        - "recalled_concepts": array of correctly explained key concepts (at least 2-3)
        - "missing_concepts": array of important concepts not mentioned (at least 1-2)
        - "misconceptions": array of objects with "text" (the misconception) and "explanation" (why it's incorrect and how to correct it)
        - "confidence_score": number between 0 and 1 indicating the overall quality and coherence of the explanation
        - "suggested_practice_questions": array of objects with "q" (question text) and "type" (essay/multiple-choice/shortAnswer)
        - "study_recommendations": array of specific suggestions for improvement and further study
        Be constructive and encouraging while being honest about gaps.`;
      }

      let lessonContext = '';
      if (documentContext && documentContext.content) {
        lessonContext = documentContext.content.substring(0, 2000);
      }

      userPrompt = `Student's explanation (transcript): "${content}"

Lesson Content to Compare Against:
${lessonContext || 'No lesson content provided'}

Analyze this explanation and return the structured feedback as described.`;
    } else {
      throw new Error('Invalid generation type');
    }

    console.log('Calling Gemini API');
    const generatedContent = await callGemini(systemPrompt, userPrompt, tier);
    console.log('Gemini response received successfully');

    if (type === 'chat') {
      return new Response(JSON.stringify({ response: generatedContent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'chat_title') {
      return new Response(JSON.stringify({ title: generatedContent.trim() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'flashcards' || type === 'quiz' || type === 'blurting' || type === 'ingest_paper') {
      try {
        let cleanContent = generatedContent.trim();
        if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
        if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
        if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);

        const parsed = JSON.parse(cleanContent.trim());
        console.log('Successfully parsed JSON response');
        return new Response(JSON.stringify({ data: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (parseError) {
        console.error('Parse error:', parseError, 'Content:', generatedContent);
        return new Response(JSON.stringify({ error: 'Failed to parse generated content', raw: generatedContent }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ data: generatedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI generate error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
