import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, Mic, Crown, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useChatContext } from '@/hooks/useChatContext';
import { useFlashcardExplanation } from '@/hooks/useFlashcardExplanation';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { useAIContext } from '@/contexts/AIContext';
import { useAnimationContext } from '@/contexts/AnimationContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePastPaperAssistant } from '@/hooks/usePastPaperAssistant';
import { MotionConditional } from '@/components/ui/MotionConditional';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SwipeableAiChatProps {
  isOpen: boolean;
  isExpanded?: boolean;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  onSaveMessage?: (message: Message) => void;
  conversationId?: string;
  autoSendMessage?: string;
}

const SwipeableAiChat: React.FC<SwipeableAiChatProps> = ({
  isOpen,
  isExpanded = false,
  messages: externalMessages,
  onMessagesChange,
  onSaveMessage,
  conversationId,
  autoSendMessage
}) => {
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiBlocked, setAiBlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { getChatContext } = useChatContext();
  const { getOrGenerateExplanation } = useFlashcardExplanation();
  const { tier, canUseAi, isStorageFull, usage, limits, refetchUsage } = useSubscription();
  const navigate = useNavigate();
  const { context: aiContext } = useAIContext();
  const { animationsEnabled } = useAnimationContext();
  const { isContentExpanded, setIsContentExpanded } = useSidebar();
  const { ingestPaper, findQuestion, getStructuredPaper } = usePastPaperAssistant();

  // Use external messages if provided, otherwise use internal state
  const messages = externalMessages ?? internalMessages;
  const setMessages = onMessagesChange ?? setInternalMessages;

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        // Set 10-second silence timeout
        setSilenceTimeout();
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        // Reset silence timeout on result
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        setSilenceTimeout();

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputValue(prev => {
            const trimmedPrev = prev.trim();
            return trimmedPrev + (trimmedPrev ? ' ' : '') + finalTranscript;
          });
        }
      };

      const setSilenceTimeout = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        }, 10000);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);

        let errorTitle = 'Speech recognition error';
        let errorDescription = 'Failed to recognize speech. Please try again.';

        // Handle specific error types
        if (event.error === 'no-speech') {
          errorTitle = 'No speech detected';
          errorDescription = 'No speech was detected. Make sure your microphone is working and speak clearly.';
        } else if (event.error === 'network') {
          errorTitle = 'Network error';
          errorDescription = 'Check your internet connection and try again.';
        } else if (event.error === 'permission-denied') {
          errorTitle = 'Microphone access denied';
          errorDescription = 'Please allow microphone access in your browser settings.';
        } else if (event.error === 'not-allowed') {
          errorTitle = 'Microphone not available';
          errorDescription = 'The microphone is not available or is being used by another application.';
        } else if (event.error === 'audio-capture') {
          errorTitle = 'Microphone error';
          errorDescription = 'No microphone input was detected. Check your device settings.';
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive',
        });
        setIsListening(false);
      };
    }
  }, [toast]);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      toast({
        title: 'Not Supported',
        description: 'Speech recognition is not supported in your browser',
        variant: 'destructive',
      });
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (error: any) {
        console.error('Error starting speech recognition:', error);
        if (error.name === 'InvalidStateError') {
          // If already started, just ensure the state is synced
          setIsListening(true);
        } else {
          toast({
            title: 'Mic Error',
            description: 'Could not start microphone. Please try again.',
            variant: 'destructive',
          });
        }
      }
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 100);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 100 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: animationsEnabled ? 'smooth' : 'auto' });
  }, [messages, animationsEnabled]);

  // Auto-send message if provided
  useEffect(() => {
    if (autoSendMessage && isOpen && !isLoading) {
      const timer = setTimeout(() => {
        handleSendMessageWithContent(autoSendMessage);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [autoSendMessage, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Function to fetch user analytics for AI context
  const fetchUserAnalytics = async (userId: string) => {
    try {
      // Fetch study analytics
      const { data: studyAnalytics } = await supabase
        .from('study_analytics')
        .select('total_study_time, subjects_studied, last_studied')
        .eq('user_id', userId)
        .single();

      // Fetch quiz performance
      const { data: quizPerformance } = await supabase
        .from('quiz_performance_analytics')
        .select('percentage, subject_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch flashcard mastery
      const { data: flashcardMastery } = await supabase
        .from('flashcard_mastery_history')
        .select('is_mastered, created_at, flashcard_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch subject analytics
      const { data: subjectAnalytics } = await supabase
        .from('subject_analytics_summary')
        .select('subject_id, total_study_time, quiz_count, average_score, weak_areas')
        .eq('user_id', userId)
        .order('total_study_time', { ascending: false });

      // Fetch past paper attempts
      const { data: paperAttempts } = await supabase
        .from('paper_attempts')
        .select('score, max_score, subject_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Process analytics into a summary
      const analytics = {
        totalStudyTime: studyAnalytics?.total_study_time || 0,
        subjectsStudied: studyAnalytics?.subjects_studied || [],
        lastStudied: studyAnalytics?.last_studied,
        quizPerformance: quizPerformance ? {
          averageScore: quizPerformance.length > 0
            ? (quizPerformance.reduce((sum: number, q: any) => sum + (q.percentage || 0), 0) / quizPerformance.length)
            : 0,
          totalAttempts: quizPerformance.length,
          recentScores: quizPerformance.slice(0, 5).map((q: any) => q.percentage)
        } : {},
        flashcardPerformance: flashcardMastery ? {
          totalReviewed: flashcardMastery.length,
          masteredCount: flashcardMastery.filter((f: any) => f.is_mastered).length,
          masteryPercentage: flashcardMastery.length > 0
            ? (flashcardMastery.filter((f: any) => f.is_mastered).length / flashcardMastery.length) * 100
            : 0,
        } : {},
        subjectMetrics: subjectAnalytics ? subjectAnalytics.map((s: any) => ({
          subject: s.subject_id,
          studyTime: s.total_study_time,
          quizzes: s.quiz_count,
          averageScore: s.average_score,
          weakAreas: s.weak_areas || []
        })) : [],
        paperPerformance: paperAttempts ? {
          averageScore: paperAttempts.length > 0
            ? (paperAttempts.reduce((sum: number, p: any) => sum + ((p.score / p.max_score) * 100), 0) / paperAttempts.length)
            : 0,
          totalAttempts: paperAttempts.length,
          recentScores: paperAttempts.slice(0, 5).map((p: any) => ((p.score / p.max_score) * 100).toFixed(1))
        } : {}
      };

      return analytics;
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      return null;
    }
  };

  const handleSendMessageWithContent = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    // Check storage limit
    if (isStorageFull) {
      toast({
        title: 'Storage Full',
        description: 'Your storage is full. Please delete some documents or upgrade to continue using AI chat.',
        variant: 'destructive',
      });
      return;
    }

    // Check if AI is available
    if (tier === 'free' && !canUseAi()) {
      setAiBlocked(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Save user message to database if callback provided
    if (onSaveMessage) {
      onSaveMessage(userMessage);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Check for past paper question reference
      let pastPaperQuestionContent = '';
      if (aiContext?.activePaper || aiContext?.activeDocument?.is_past_paper) {
        const paperId = aiContext.activePaper ? (aiContext.activePaper as any).id || aiContext.activePaper.subject : aiContext.activeDocument?.id;

        // Extract question number if possible (e.g. "1.1", "2.1.3")
        const questionMatch = messageContent.match(/question\s*([0-9]+(\.[0-9]+)*)/i);
        if (questionMatch && paperId) {
          const qNumber = questionMatch[1];
          console.log('[SwipeableAiChat] Detected question reference:', qNumber);

          // Get structured paper
          let structuredPaper = await getStructuredPaper(paperId);

          // If not exists and we have full content, ingest it
          if (!structuredPaper && aiContext.activeDocument?.content) {
             structuredPaper = await ingestPaper(paperId, aiContext.activeDocument.content, aiContext.activeDocument.name);
          }

          if (structuredPaper) {
            const questionData = findQuestion(structuredPaper as any, qNumber);
            if (questionData) {
              console.log('[SwipeableAiChat] Found structured question data for:', qNumber);
              pastPaperQuestionContent = `
                USER IS ASKING ABOUT QUESTION ${questionData.question_number}:
                Question Text: ${questionData.question_text}
                Context/Case Study: ${questionData.context || 'N/A'}
                Section/Topic: ${questionData.section || 'N/A'} / ${questionData.topic || 'N/A'}
                Marks: ${questionData.marks || 'N/A'}

                USE THIS STORED DATA TO PROVIDE A FAST, ACCURATE EXPLANATION WITHOUT RE-READING THE FULL PAPER.
              `;
            }
          }
        }
      }

      // Construct context for the backend
      const backendContext: any = {
        currentPage: aiContext?.currentPage || 'home',
        pastPaperQuestion: pastPaperQuestionContent,
      };

      if (aiContext?.activeDocument) {
        backendContext.documentTitle = aiContext.activeDocument.name;
        backendContext.documentContent = aiContext.activeDocument.content;
      }

      if (aiContext?.activePaper) {
        backendContext.pastPaper = {
          title: `${aiContext.activePaper.subject} ${aiContext.activePaper.year} Paper ${aiContext.activePaper.paper}`,
          year: aiContext.activePaper.year,
          subject: aiContext.activePaper.subject
        };
      }

      if (aiContext?.activeFlashcard) {
        backendContext.documentTitle = `Flashcard: ${aiContext.activeFlashcard.front}`;
        backendContext.documentContent = `Question: ${aiContext.activeFlashcard.front}\nAnswer: ${aiContext.activeFlashcard.back}`;
      }

      if (conversationId) {
        const dbContext = await getChatContext(conversationId);

        if (dbContext) {
          if (dbContext.subject_id && !backendContext.studySession) {
            backendContext.studySession = {
              subject: dbContext.subject_id,
              duration: 25 // Default duration
            };
          }

          // Check for flashcard explanation cache
          if (dbContext.active_flashcard_id) {
            const cachedExplanation = await getOrGenerateExplanation(dbContext.active_flashcard_id, 'simple');
            if (cachedExplanation?.cached) {
              console.log('[SwipeableAiChat] Using cached flashcard explanation');
            }
          }
        }
      }

      // Fetch and include user analytics for personalized advice
      if (session.user?.id) {
        const userAnalytics = await fetchUserAnalytics(session.user.id);
        if (userAnalytics) {
          backendContext.userAnalytics = userAnalytics;
          // Add a hint to the AI about how to use the analytics
          backendContext.analyticsHint = `User's analytics show they have ${userAnalytics.subjectsStudied?.length || 0} subjects, studied for ${userAnalytics.totalStudyTime || 0} minutes total, and their quiz average is ${userAnalytics.quizPerformance?.averageScore?.toFixed(1) || 'N/A'}%. When giving improvement advice, prioritize recommending platform features like specific past papers, flashcard decks in weak areas, and relevant lessons over generic study tips.`;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: [
              ...messages.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              { role: 'user', content: userMessage.content }
            ],
            language: 'en',
            context: backendContext
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage = errorData;
        try {
          const parsed = JSON.parse(errorData);
          if (parsed.error) {
            errorMessage = parsed.error;
          }
        } catch (e) {
          // Keep original errorData if not JSON
        }
        throw new Error(errorMessage || 'Failed to get AI response');
      }

      let fullContent = '';
      const reader = response.body?.getReader();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.choices?.[0]?.delta?.content) {
                  fullContent += json.choices[0].delta.content;
                }
              } catch (e) {
                // Skip lines that aren't valid JSON
              }
            }
          }
        }
      }

      if (!fullContent) {
        throw new Error('No response received from AI');
      }

      const assistantMessage: Message = {
        id: (Date.now() + Math.random()).toString(),
        role: 'assistant',
        content: fullContent,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message to database if callback provided
      if (onSaveMessage) {
        onSaveMessage(assistantMessage);
      }

      // Refresh token usage indicator
      if (refetchUsage) {
        refetchUsage();
      }
    } catch (error) {
      console.error('AI Chat error:', error);

      // If server-side limit reached (429), show the blocked UI instead of error toast
      if (error instanceof Error && (error.message.includes('token limit') || error.message.includes('message limit') || error.message.includes('Daily AI'))) {
        setAiBlocked(true);
        if (refetchUsage) refetchUsage();
        return;
      }

      let errorMessage = 'Failed to get AI response. ';
      if (error instanceof Error) {
        if (error.message.includes('authenticated')) {
          errorMessage += 'You need to be logged in.';
        } else {
          errorMessage += error.message;
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Wrapper for sending a message from the input field
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const messageToSend = inputValue;
    setInputValue('');
    await handleSendMessageWithContent(messageToSend);
  };

  // Handle pasted text from past papers
  const handlePaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setInputValue(prev => prev + pastedText);
    }
  };

  if (!isOpen) return null;

  
  const showBlockedUI = aiBlocked || (tier === 'free' && !canUseAi());

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-card ${isExpanded ? 'lg:pb-0 pb-20' : ''}`}>
      {/* AI Limit Reached - Soft Banner */}
      {showBlockedUI && (
        <div className="p-3 bg-muted/80 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {usage.activeDaysCount >= 5 ? 'Monthly limit reached' : 'Daily limit reached'}
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade for unlimited AI assistance
              </p>
            </div>
            <Button size="sm" variant="default" className="gap-1.5 flex-shrink-0" onClick={() => navigate('/settings/billing')}>
              <Crown className="w-3.5 h-3.5" />
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm text-muted-foreground font-medium mb-1">
              Start a conversation with AI
            </p>
            <p className="text-xs text-muted-foreground opacity-75">
              Ask questions about your studies
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MotionConditional
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary text-foreground rounded-bl-none'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </MotionConditional>
            ))}
            {isLoading && (
              <MotionConditional
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-secondary text-foreground rounded-lg rounded-bl-none px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </MotionConditional>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-2 flex-shrink-0 flex flex-col gap-2 bg-card">
        {isListening && (
          <div className="flex items-center gap-2 px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded text-red-700 dark:text-red-400 text-xs font-medium">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Recording...</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Ask your question or speak..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
              className="min-h-[40px] py-2 resize-none text-sm transition-[height] duration-200"
              rows={1}
            />
          </div>
          <div className="flex gap-2 mb-0.5">
            <Button
              onClick={handleMicClick}
              variant={isListening ? 'default' : 'outline'}
              size="sm"
              className="px-3 h-9 w-9 flex-shrink-0"
              title={isListening ? 'Stop listening' : 'Start listening'}
            >
              {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 h-9 text-sm font-medium flex-shrink-0"
              size="sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipeableAiChat;
