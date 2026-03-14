import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { DocumentChunk } from '@/lib/documentProcessor';
import { supabase } from '@/integrations/supabase/client';

export type AIProvider = 'google' | 'openai';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GeneratedLesson {
  chunkNumber: number;
  content: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
  tokenUsage?: TokenUsage;
}

export interface GenerationProgress {
  currentChunk: number;
  totalChunks: number;
  completedChunks: number;
  visualProgress: number;
  currentBatch?: number;
  totalBatches?: number;
  totalPages?: number;
}

interface BatchInfo {
  totalBatches: number;
  currentBatch: number;
  pagesInBatch: number;
  totalPages: number;
}

interface LessonGenerationContextType {
  lessons: GeneratedLesson[];
  progress: GenerationProgress;
  isGenerating: boolean;
  selectedProvider: AIProvider;
  tokenUsage: TokenUsage;
  setSelectedProvider: (provider: AIProvider) => void;
  generateLessons: (chunks: DocumentChunk[], provider: AIProvider, batchInfo?: BatchInfo) => Promise<void>;
  updateLesson: (chunkNumber: number, content: string) => void;
  cancelGeneration: () => void;
  reset: () => void;
  getCombinedContent: () => string;
  loadSavedLessons: (savedLessons: any[]) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  documentId: string | null;
  setDocumentId: (id: string | null) => void;
}

const LessonGenerationContext = createContext<LessonGenerationContextType | undefined>(undefined);

export const LessonGenerationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lessons, setLessons] = useState<GeneratedLesson[]>([]);
  const [progress, setProgress] = useState<GenerationProgress>({
    currentChunk: 0,
    totalChunks: 0,
    completedChunks: 0,
    visualProgress: 0,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [visualProgress, setVisualProgress] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('google');
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
  const [documentId, setDocumentId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const currentGenerationIdRef = useRef<string | null>(null);

  // Simulated visual progress effect
  React.useEffect(() => {
    let interval: any;

    if (isGenerating) {
      setVisualProgress(2); // Start at 2%

      interval = setInterval(() => {
        setVisualProgress(prev => {
          if (prev < 60) {
            // Fast progress to 60% (increments by ~0.5% every 100ms)
            return Math.min(60, prev + 0.5);
          } else if (prev < 99) {
            // Slow progress to 99% (increments by ~0.05% every 100ms)
            return Math.min(99, prev + 0.05);
          }
          return prev; // Stay at 99% until finished
        });
      }, 100);
    } else {
      setVisualProgress(0);
      if (interval) clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const updateLesson = useCallback((chunkNumber: number, content: string) => {
    setLessons((prev) =>
      prev.map((l) =>
        l.chunkNumber === chunkNumber
          ? { ...l, content }
          : l
      )
    );
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('Cancelling generation...');
      abortControllerRef.current.abort();
      currentGenerationIdRef.current = null;
      setIsGenerating(false);
      isGeneratingRef.current = false;
      abortControllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancelGeneration();
    setLessons([]);
    setProgress({
      currentChunk: 0,
      totalChunks: 0,
      completedChunks: 0,
      visualProgress: 0,
    });
    setTokenUsage({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  }, [cancelGeneration]);

  const loadSavedLessons = useCallback((savedLessons: any[]) => {
    const loadedLessonsArray = savedLessons.map((lesson) => ({
      chunkNumber: lesson.chunk_number,
      content: lesson.content,
      status: lesson.status as 'completed' | 'processing' | 'error',
      error: lesson.error,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    }));

    setLessons(loadedLessonsArray);

    const completedCount = loadedLessonsArray.filter((l) => l.status === 'completed').length;
    const totalCount = loadedLessonsArray.length;

    setProgress({
      currentChunk: totalCount,
      totalChunks: totalCount,
      completedChunks: completedCount,
      visualProgress: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    });
    // If loading saved lessons, we might want to override visualProgress too
    if (totalCount > 0 && completedCount === totalCount) {
      setVisualProgress(100);
    }
  }, []);

  const getCombinedContent = useCallback(() => {
    return lessons
      .filter((l) => l.status === 'completed')
      .sort((a, b) => a.chunkNumber - b.chunkNumber)
      .map((l) => l.content)
      .join('\n\n---\n\n');
  }, [lessons]);

  const generateLessons = useCallback(
    async (
      chunks: DocumentChunk[],
      provider: AIProvider,
      batchInfo?: BatchInfo,
      docId?: string
    ) => {
      if (isGeneratingRef.current) {
        console.warn('Generation already in progress. Ignoring new generation request.');
        return;
      }

      if (docId) setDocumentId(docId);

      // Start immediately to show the UI
      setIsGenerating(true);
      isGeneratingRef.current = true;

      if (chunks.length === 0) {
        setIsGenerating(false);
        isGeneratingRef.current = false;
        return;
      }

      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      currentGenerationIdRef.current = generationId;

      const newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;

      const initialLessons = chunks.map((chunk) => ({
        chunkNumber: chunk.id,
        content: '',
        status: 'idle' as const,
      }));
      setLessons(initialLessons);

      setProgress({
        currentChunk: 0,
        totalChunks: chunks.length,
        completedChunks: 0,
        visualProgress: 2,
        currentBatch: batchInfo?.currentBatch,
        totalBatches: batchInfo?.totalBatches,
        totalPages: batchInfo?.totalPages,
      });

      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const generateWithRetry = async (
        chunk: DocumentChunk,
        functionName: string,
        fallbackFunctionName: string | null = null,
        maxRetries: number = 3
      ): Promise<{ lessonContent: string; tokenUsage?: TokenUsage } | null> => {
        let lastError: Error | null = null;
        const REQUEST_TIMEOUT = 120000;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (newAbortController.signal.aborted || currentGenerationIdRef.current !== generationId) {
            return null;
          }

          try {
            // Check again before making the request
            if (newAbortController.signal.aborted || currentGenerationIdRef.current !== generationId) {
              return null;
            }

            const timeoutSignal = new AbortController();
            const timeoutId = setTimeout(() => timeoutSignal.abort(), REQUEST_TIMEOUT);

            try {
              const response = await supabase.functions.invoke(functionName, {
                body: {
                  documentText: chunk.content,
                  chunkNumber: chunk.id,
                  totalChunks: chunks.length,
                  batchInfo: batchInfo
                    ? {
                        batchNumber: batchInfo.currentBatch,
                        totalBatches: batchInfo.totalBatches,
                        pagesInBatch: batchInfo.pagesInBatch,
                      }
                    : undefined,
                },
                signal: timeoutSignal.signal,
              });

              clearTimeout(timeoutId);

              if (response.error) {
                const statusCode = (response.error as any)?.status || '500';
                lastError = new Error(
                  `Edge Function error (${statusCode}): ${response.error.message || 'Unknown error'}`
                );

                if (statusCode === '429' || statusCode === '503' || statusCode === '500') {
                  const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
                  if (attempt < maxRetries - 1) {
                    await sleep(backoffMs);
                    continue;
                  }
                }
                throw lastError;
              }

              const { lessonContent, tokenUsage: chunkTokens } = response.data;
              return { lessonContent, tokenUsage: chunkTokens };
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
                lastError = new Error('TIMEOUT: Request took too long to complete (>2 minutes).');
              } else {
                throw fetchError;
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorStr = lastError.message.toLowerCase();
            const isRetryable = errorStr.includes('timeout') || errorStr.includes('abort') || 
                               errorStr.includes('rate limit') || errorStr.includes('429') || 
                               errorStr.includes('503') || errorStr.includes('500') || 
                               errorStr.includes('network') || errorStr.includes('fetch');

            if (!isRetryable && attempt === 0) {
              if (fallbackFunctionName && functionName !== fallbackFunctionName) {
                return generateWithRetry(chunk, fallbackFunctionName, null, maxRetries);
              }
              throw lastError;
            }

            if (attempt < maxRetries - 1 && isRetryable) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
              await sleep(backoffMs);
            }
          }
        }
        return null;
      };

      // Implement a proper concurrency pool
      const maxConcurrency = 10;
      const queue = [...chunks];
      const activeTasks = new Set();
      let completedCount = 0;
      let fatalError: Error | null = null;

      const processQueue = async () => {
        while (queue.length > 0 && activeTasks.size < maxConcurrency && !fatalError) {
          if (newAbortController.signal.aborted || currentGenerationIdRef.current !== generationId) break;

          const chunk = queue.shift()!;
          const taskPromise = (async () => {
            activeTasks.add(chunk.id);

            // Set to processing
            setLessons(prev => prev.map(l => l.chunkNumber === chunk.id ? { ...l, status: 'processing' } : l));

            try {
const primaryFunction = provider === 'google' ? 'generate-lesson-gemini' : 'generate-lesson-openai';
              const fallbackFunction = provider === 'google' ? 'generate-lesson-openai' : 'generate-lesson-gemini';

              const result = await generateWithRetry(chunk, primaryFunction, fallbackFunction);

              if (result && currentGenerationIdRef.current === generationId) {
                const { lessonContent, tokenUsage: chunkTokens } = result;

                setLessons(prev => prev.map(l => l.chunkNumber === chunk.id ? {
                  ...l,
                  content: lessonContent,
                  status: 'completed',
                  tokenUsage: chunkTokens
                } : l));

                if (chunkTokens) {
                  setTokenUsage(prev => ({
                    inputTokens: prev.inputTokens + chunkTokens.inputTokens,
                    outputTokens: prev.outputTokens + chunkTokens.outputTokens,
                    totalTokens: prev.totalTokens + chunkTokens.inputTokens + chunkTokens.outputTokens,
                  }));
                }

                completedCount++;
                setProgress(prev => {
                  const newCompleted = prev.completedChunks + 1;
                  return {
                    ...prev,
                    completedChunks: newCompleted,
                    currentChunk: Math.max(prev.currentChunk, chunk.id),
                  };
                });
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Fatal error in chunk ${chunk.id}:`, errorMessage);

              setLessons(prev => prev.map(l => l.chunkNumber === chunk.id ? { ...l, status: 'error', error: errorMessage } : l));

              fatalError = error instanceof Error ? error : new Error(errorMessage);
              cancelGeneration();
            } finally {
              activeTasks.delete(chunk.id);
              if (!fatalError) processQueue(); // Try to start next task
            }
          })();

          // Don't await the promise here, just move to the next iteration
        }
      };

      // Start initial tasks
      await processQueue();

      // Wait for all active tasks to complete
      while (activeTasks.size > 0) {
        if (newAbortController.signal.aborted || currentGenerationIdRef.current !== generationId || fatalError) break;
        await sleep(500);
      }

      if (fatalError) {
        setIsGenerating(false);
        isGeneratingRef.current = false;
        throw fatalError;
      }

      if (currentGenerationIdRef.current === generationId) {
        setVisualProgress(100);
        await sleep(500); // Give a moment to see 100%
        setIsGenerating(false);
        abortControllerRef.current = null;
        isGeneratingRef.current = false;
      }
    },
    [cancelGeneration]
  );

  const value = {
    lessons,
    progress: { ...progress, visualProgress },
    isGenerating,
    setIsGenerating,
    documentId,
    setDocumentId,
    selectedProvider,
    tokenUsage,
    setSelectedProvider,
    generateLessons,
    updateLesson,
    cancelGeneration,
    reset,
    getCombinedContent,
    loadSavedLessons,
  };

  return (
    <LessonGenerationContext.Provider value={value}>
      {children}
    </LessonGenerationContext.Provider>
  );
};

export const useLessonGeneration = () => {
  const context = useContext(LessonGenerationContext);
  if (context === undefined) {
    throw new Error('useLessonGeneration must be used within a LessonGenerationProvider');
  }
  return context;
};
