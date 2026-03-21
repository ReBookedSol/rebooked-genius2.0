import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, Mic, Crown, Zap, Paperclip, X, FileIcon, ImageIcon } from 'lucide-react';
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
import { useTranslation } from '@/hooks/use-translation';
import { useAnimationContext } from '@/contexts/AnimationContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { usePastPaperAssistant } from '@/hooks/usePastPaperAssistant';
import { MotionConditional } from '@/components/ui/MotionConditional';
import { STUDY_PLAN_SYSTEM_PROMPT } from '@/lib/aiStudyPlanParser';
import AIChatMessageContent from '@/components/chat/AIChatMessageContent';

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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Memoized message item to prevent re-renders
const MessageItem = memo(({ msg }: { msg: Message }) => (
  <MotionConditional
    key={msg.id}
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.15 }}
    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
  >
    <div
      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
        msg.role === 'user'
          ? 'bg-primary text-primary-foreground rounded-br-none'
          : 'bg-secondary text-foreground rounded-bl-none'
      }`}
    >
      {msg.role === 'user' ? (
        <p>{msg.content}</p>
      ) : (
        <AIChatMessageContent content={msg.content} />
      )}
    </div>
  </MotionConditional>
));

MessageItem.displayName = 'MessageItem';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSendTranscriptRef = useRef<string>('');
  const autoSendProcessedRef = useRef<string>('');
  const { toast } = useToast();
  const { getChatContext } = useChatContext();
  const { getOrGenerateExplanation } = useFlashcardExplanation();
  const { tier, canUseAi, isStorageFull, usage, limits, refetchUsage } = useSubscription();
  const navigate = useNavigate();
  const { context: aiContext } = useAIContext();
  const { language: currentLanguage } = useTranslation();
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
        
        // Auto-send if we have transcript content when recording stops
        const finalContent = autoSendTranscriptRef.current.trim();
        if (finalContent) {
          // Reset the ref immediately so it doesn't double-send
          autoSendTranscriptRef.current = '';
          handleSendMessageWithContent(finalContent);
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
            const newContent = trimmedPrev + (trimmedPrev ? ' ' : '') + finalTranscript;
            autoSendTranscriptRef.current = newContent; // Update ref for auto-send
            return newContent;
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

  const handleMicClick = useCallback(() => {
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
        // The onend event will trigger the auto-send
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
    } else {
      try {
        // Clear previous input when starting a new recording
        setInputValue('');
        autoSendTranscriptRef.current = '';
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
  }, [isListening, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image (JPG, PNG, WEBP), PDF, or text file',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    // Focus the textarea so user can type a message about the file
    textareaRef.current?.focus();
  }, [toast]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 100);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 100 ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  // Scroll to bottom when new messages arrive (optimized)
  useEffect(() => {
    if (messagesContainerRef.current) {
      // Use a microtask for more immediate scrolling
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length]); // Only depend on message count, not entire messages array

  // Auto-send message if provided (with guard against re-sends)
  useEffect(() => {
    if (autoSendMessage && isOpen && !isLoading && autoSendProcessedRef.current !== autoSendMessage) {
      autoSendProcessedRef.current = autoSendMessage;
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
      // Fetch study analytics (aggregate from study_analytics table)
      const { data: studyAnalytics } = await supabase
        .from('study_analytics')
        .select('total_study_minutes, date, sessions_count, subject_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      // Calculate totals from study_analytics
      const totalStudyMinutes = studyAnalytics
        ? studyAnalytics.reduce((sum: number, row: any) => sum + (row.total_study_minutes || 0), 0)
        : 0;
      const lastStudied = studyAnalytics && studyAnalytics.length > 0 ? studyAnalytics[0].date : null;
      const uniqueSubjects = studyAnalytics
        ? [...new Set(studyAnalytics.map((r: any) => r.subject_id).filter(Boolean))]
        : [];

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
        .select('action, created_at, flashcard_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch past paper attempts
      const { data: paperAttempts } = await supabase
        .from('past_paper_attempts')
        .select('score, max_score, completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(10);

      // Process analytics into a summary
      const analytics = {
        totalStudyTime: totalStudyMinutes,
        subjectsStudied: uniqueSubjects,
        lastStudied,
        quizPerformance: quizPerformance ? {
          averageScore: quizPerformance.length > 0
            ? (quizPerformance.reduce((sum: number, q: any) => sum + (q.percentage || 0), 0) / quizPerformance.length)
            : 0,
          totalAttempts: quizPerformance.length,
          recentScores: quizPerformance.slice(0, 5).map((q: any) => q.percentage)
        } : {},
        flashcardPerformance: flashcardMastery ? {
          totalReviewed: flashcardMastery.length,
          masteredCount: flashcardMastery.filter((f: any) => f.action === 'mastered').length,
          masteryPercentage: flashcardMastery.length > 0
            ? (flashcardMastery.filter((f: any) => f.action === 'mastered').length / flashcardMastery.length) * 100
            : 0,
        } : {},
        paperPerformance: paperAttempts ? {
          averageScore: paperAttempts.length > 0
            ? (paperAttempts.reduce((sum: number, p: any) => sum + ((p.score / p.max_score) * 100), 0) / paperAttempts.length)
            : 0,
          totalAttempts: paperAttempts.length,
          recentScores: paperAttempts.slice(0, 5).map((p: any) => ((p.score / p.max_score) * 100).toFixed(1))
        } : {}
      };

      // Fetch user's registered subjects directly from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('subjects, grade, curriculum')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        (analytics as any).registeredSubjects = profileData.subjects;
        (analytics as any).grade = profileData.grade;
        (analytics as any).curriculum = profileData.curriculum;
      }

      return analytics;
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      return null;
    }
  };

  const handleSendMessageWithContent = async (messageContent: string) => {
    if ((!messageContent.trim() && !selectedFile) || isLoading) return;

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

    // Note: message is added to state later (after file processing) to include attachment context

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

      // Add active test/quiz context
      if (aiContext?.activeQuiz) {
        backendContext.activeQuiz = aiContext.activeQuiz;
      }
      if (aiContext?.activeExam) {
        backendContext.activeExam = aiContext.activeExam;
      }
      if (aiContext?.activeNbtTest) {
        backendContext.activeNbtTest = aiContext.activeNbtTest;
      }

      if (aiContext?.activeAnalytics) {
        backendContext.activeAnalyticsView = aiContext.activeAnalytics.view;
        backendContext.metrics = aiContext.activeAnalytics;
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

      // Handle File Upload & Attachment Context
      let attachmentUrl = null;
      let attachmentType = null;
      let attachmentName = null;
      let fileContext = '';

      if (selectedFile) {
        setIsUploading(true);
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          console.log('[File Upload] Starting upload:', { fileName, size: selectedFile.size, type: selectedFile.type });

          const { error: uploadError, data } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, selectedFile);

          if (uploadError) {
             console.error('[File Upload] Storage error:', uploadError);
             throw new Error(`Upload failed: ${uploadError.message}`);
          }

          if (!data?.path) {
             console.error('[File Upload] No path returned from upload');
             throw new Error('Upload succeeded but no file path returned');
          }

          attachmentUrl = data.path;
          attachmentType = selectedFile.type;
          attachmentName = selectedFile.name;

          console.log('[File Upload] Upload successful:', attachmentUrl);

          // If image, convert to Base64 for Gemini multimodal
          if (attachmentType.startsWith('image/')) {
             try {
               const buffer = await selectedFile.arrayBuffer();
               const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
               backendContext.inlineData = {
                 mimeType: attachmentType,
                 data: base64
               };
               console.log('[File Upload] Image converted to base64');
             } catch (e) {
               console.error('[File Upload] Error converting image to base64:', e);
               fileContext = `[User attached an image: ${attachmentName}]`;
             }
          } else if (attachmentType === 'application/pdf') {
             // For PDFs, pass the storage URL and let backend fetch it
             fileContext = `[User attached a PDF: ${attachmentName}] - File stored at: ${attachmentUrl}`;
             console.log('[File Upload] PDF attachment added to context');
          } else {
             // For other documents/text, indicate the user attached a file
             fileContext = `[User attached a file: ${attachmentName}]`;
          }
        } catch (err: any) {
           console.error('[File Upload] Complete error:', err);
           toast({
             title: 'Upload failed',
             description: err.message || 'Could not upload file. Please try again.',
             variant: 'destructive'
           });
           setIsUploading(false);
           return;
        } finally {
           setIsUploading(false);
        }
      }

      const finalMessageContent = messageContent + (fileContext ? `\n\n${fileContext}` : '');
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: finalMessageContent,
      };

      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      const uploadedFileBackup = selectedFile;
      setSelectedFile(null); // Clear early for UX
      setIsLoading(true);

      // Save user message to database if callback provided
      if (onSaveMessage) {
        onSaveMessage(userMessage); // TODO: pass attachment details if schema supports it
      }

      // Fetch and include user analytics for personalized advice
      if (session.user?.id) {
        const userAnalytics = await fetchUserAnalytics(session.user.id);
        if (userAnalytics) {
          backendContext.userAnalytics = userAnalytics;
          // Add a hint to the AI about how to use the analytics
          const subjectsList = (userAnalytics as any).registeredSubjects ? (userAnalytics as any).registeredSubjects.join(', ') : 'unknown subjects';
          const gradeInfo = (userAnalytics as any).grade ? `Grade ${(userAnalytics as any).grade}` : '';
          
          backendContext.analyticsHint = `IMPORTANT CONTEXT ABOUT THIS LEARNER: They are in ${gradeInfo} taking: ${subjectsList}. Their analytics show they have studied for ${userAnalytics.totalStudyTime || 0} minutes total, and their quiz average is ${userAnalytics.quizPerformance?.averageScore?.toFixed(1) || 'N/A'}%. \n\nWHEN CONTINUING THE CHAT, YOU OBSERVE: The user is currently on the "${backendContext.currentPage}" page. If activeQuiz or activeExam data is present, they are literally looking at that exact question right now. Provide specific, tailored advice based on this exact data. Refer to their actual subjects and progress.`;
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
              { role: 'user', content: finalMessageContent }
            ],
            clientSystemPrompt: STUDY_PLAN_SYSTEM_PROMPT + `\n\nCRITICAL CONTEXT: The current date and time is ${new Date().toLocaleString()}. WHEN CREATING REMINDERS OR CALENDAR EVENTS, USE THIS SPECIFIC DATE TO DETERMINE "TOMORROW" OR "NEXT WEEK" AND OUTPUT VALID UPCOMING DATES.`,
            language: currentLanguage || 'en',
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
  const handleSendMessage = useCallback(async () => {
    if ((!inputValue.trim() && !selectedFile) || isLoading || isUploading) return;
    const messageToSend = inputValue;
    await handleSendMessageWithContent(messageToSend);
  }, [inputValue, selectedFile, isLoading, isUploading]);

  // Handle pasted text from past papers
  const handlePaste = async (_e: React.ClipboardEvent) => {
    // Let the browser handle paste natively into the textarea
    // No manual intervention needed — the textarea handles it
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent" style={{ contain: 'layout style paint' }}>
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
              <MessageItem key={msg.id} msg={msg} />
            ))}
            {isLoading && (
              <MotionConditional
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
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
          <div className="flex items-center gap-3 px-3 py-2 bg-primary/10 rounded-lg text-primary text-xs font-semibold overflow-hidden border border-primary/20 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-1 h-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-primary rounded-full"
                  animate={{
                    height: ["20%", "100%", "40%", "80%", "30%"],
                  }}
                  transition={{
                    duration: 0.8 + Math.random() * 0.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
            <span className="tracking-wide uppercase">Listening...</span>
          </div>
        )}

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="relative flex items-center gap-3 p-2 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex-shrink-0 w-8 h-8 rounded bg-background flex items-center justify-center">
              {selectedFile.type.startsWith('image/') ? (
                <ImageIcon className="w-4 h-4 text-primary" />
              ) : (
                <FileIcon className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setSelectedFile(null)}
            >
              <X className="w-3 h-3" />
            </Button>
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
          <div className="flex gap-1.5 mb-0.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              size="sm"
              className="px-2 h-9 flex-shrink-0 text-muted-foreground hover:text-foreground hidden"
              title="Attach an image or document"
              disabled={isLoading || isUploading}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleMicClick}
              variant={isListening ? 'default' : 'outline'}
              size="sm"
              className="px-2 h-9 w-9 flex-shrink-0"
              title={isListening ? 'Stop listening' : 'Start listening'}
              disabled={isLoading || isUploading}
            >
              {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && !selectedFile) || isLoading || isUploading}
              className="px-4 h-9 text-sm font-medium flex-shrink-0"
              size="sm"
            >
              {isLoading || isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipeableAiChat;
