import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PastPaperQuestion {
  question_number: string;
  question_text: string;
  context: string;
  section: string;
  topic: string;
  marks?: number;
}

export function usePastPaperAssistant() {
  const { user } = useAuth();
  const [isIngesting, setIsIngesting] = useState(false);

  const getStructuredPaper = useCallback(async (documentId: string) => {
    const { data, error } = await supabase
      .from('past_paper_questions' as any)
      .select('*')
      .eq('document_id', documentId)
      .order('question_number', { ascending: true });

    if (error) {
      console.error('Error fetching structured paper questions:', error);
      return null;
    }

    return data && data.length > 0 ? data : null;
  }, []);

  const ingestPaper = useCallback(async (documentId: string, content: string, title: string) => {
    if (!user) return null;

    setIsIngesting(true);
    try {
      // 1. Check if already exists
      const existing = await getStructuredPaper(documentId);
      if (existing) {
        setIsIngesting(false);
        return existing;
      }

      // 2. Call AI to structure the paper
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type: 'ingest_paper',
          content: content.substring(0, 30000), // Limit to avoid token issues
          title: title,
        },
      });

      if (error) throw error;
      if (!data?.data) throw new Error('Failed to ingest paper');

      const structuredData = data.data;

      // 3. Save to past_paper_questions (Granular rows)
      const questionsToInsert = structuredData.map((q: any) => ({
        document_id: documentId,
        question_number: q.question_number,
        question_text: q.question_text,
        context: q.context,
        section: q.section,
        topic: q.topic,
        marks: q.marks
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('past_paper_questions' as any)
        .insert(questionsToInsert)
        .select();

      if (insertError) throw insertError;

      setIsIngesting(false);
      return insertedData;
    } catch (error) {
      console.error('Error ingesting paper:', error);
      setIsIngesting(false);
      return null;
    }
  }, [user, getStructuredPaper]);

  const findQuestion = useCallback((structuredPaper: PastPaperQuestion[], questionNumber: string) => {
    // Try exact match
    let q = structuredPaper.find(q => q.question_number === questionNumber);
    
    // Try fuzzy match (e.g. if user says "1.1" but it's "Question 1.1")
    if (!q) {
      q = structuredPaper.find(q => 
        q.question_number.includes(questionNumber) || 
        questionNumber.includes(q.question_number)
      );
    }

    return q || null;
  }, []);

  return {
    ingestPaper,
    getStructuredPaper,
    findQuestion,
    isIngesting
  };
}
