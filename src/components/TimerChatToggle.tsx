import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, MessageSquare, X, Maximize2, Minimize2, Plus } from 'lucide-react';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTranslation } from '@/hooks/use-translation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SwipeableAiChat from './SwipeableAiChat';
import { FreeTokenIndicator } from './FreeTokenIndicator';

const TOGGLE_STATE_KEY = 'timer_chat_state';
const CHAT_WIDTH_KEY = 'chat_panel_width';
const DEFAULT_CHAT_WIDTH = 450;
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 700;

const STUDY_TIPS = [
  "Take short breaks every 25-50 minutes to keep your mind fresh.",
  "Explaining a concept to someone else is the best way to learn it.",
  "Stay hydrated! Your brain needs water to function at its best.",
  "Try to study at the same time every day to build a habit.",
  "Focus on one subject at a time to avoid cognitive overload.",
  "Write down your goals for each study session before you start.",
  "Active recall is more effective than passive re-reading.",
  "Interleaving different topics helps improve long-term retention.",
];

interface ToggleState {
  activeTab: 'timer' | 'chat';
  isExpanded: boolean;
  isVisible: boolean;
  seeTimer: boolean;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const TimerChatToggle = () => {
  const timer = useStudyTimer();
  const { t } = useTranslation();
  const {
    isChatExpanded,
    setIsChatExpanded,
    setChatVisible,
    setChatWidth: setContextChatWidth,
    floatingPanelOpen,
    setFloatingPanelOpen,
    setMobileMoreOpen,
    setIsDraggingResizer: setIsDraggingResizerContext,
  } = useSidebar();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [minutesInput, setMinutesInput] = useState<string>('25');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatWidth, setChatWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CHAT_WIDTH_KEY);
      return saved ? Math.min(Math.max(parseInt(saved), MIN_CHAT_WIDTH), MAX_CHAT_WIDTH) : DEFAULT_CHAT_WIDTH;
    } catch {
      return DEFAULT_CHAT_WIDTH;
    }
  });
  const [isDraggingResizer, setIsDraggingResizer] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [_isLoadingChat, setIsLoadingChat] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [autoSendMessage, setAutoSendMessage] = useState<string>('');
  const [studyTip] = useState(() => STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)]);

  const [state, setState] = useState<ToggleState>(() => {
    try {
      const saved = localStorage.getItem(TOGGLE_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error parsing toggle state:', e);
    }
    return { activeTab: 'timer', isExpanded: false, isVisible: true, seeTimer: true };
  });

  // Prevent scrollbar flash when chat sidebar opens/closes and lock body scroll on mobile fullscreen
  useEffect(() => {
    if (state.isExpanded) {
      // When chat is expanded, prevent body scroll (especially on mobile)
      document.body.style.overflow = 'hidden';
      document.documentElement.style.scrollbarGutter = 'stable';
    } else if (state.isVisible) {
      // Set scrollbar-gutter so the scrollbar space is always reserved
      document.documentElement.style.scrollbarGutter = 'stable';
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.scrollbarGutter = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [state.isExpanded, state.isVisible]);

  // Fetch user subjects + add General Studies option
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;

      const { data: userSubjects } = await supabase
        .from('user_subjects')
        .select('subject_id, subjects(*)')
        .eq('user_id', user.id);

      // Start with General Studies option
      const subs: Subject[] = [
        {
          id: 'general-studies',
          name: 'General Studies',
          color: '#6B7280', // Gray color for general
        },
      ];

      if (userSubjects) {
        userSubjects.forEach((us: any) => {
          subs.push({
            id: us.subjects.id,
            name: us.subjects.name,
            color: us.subjects.color || '#22c55e',
          });
        });
      }

      setSubjects(subs);
    };

    fetchSubjects();
  }, [user]);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(TOGGLE_STATE_KEY, JSON.stringify(state));
  }, [state]);

  // Keep global overlay flag in sync (popup OR expanded sidebar)
  useEffect(() => {
    const open = state.isExpanded || state.isVisible;
    setFloatingPanelOpen(open);
  }, [state.isExpanded, state.isVisible, setFloatingPanelOpen]);

  // If something else (e.g. Mobile “More”) closes the floating panel globally, collapse locally.
  useEffect(() => {
    if (!floatingPanelOpen && (state.isVisible || state.isExpanded)) {
      setState(prev => ({ ...prev, isVisible: false, isExpanded: false }));
      setShowChatHistory(false);
    }
  }, [floatingPanelOpen, state.isVisible, state.isExpanded]);

  // Persist chat width to localStorage and sync with context
  useEffect(() => {
    localStorage.setItem(CHAT_WIDTH_KEY, chatWidth.toString());
    setContextChatWidth(chatWidth);
  }, [chatWidth, setContextChatWidth]);

  // Sync with sidebar context when expanded state changes
  useEffect(() => {
    setIsChatExpanded(state.isExpanded);
    if (state.isExpanded) {
      setChatVisible(true);
      // Set the chat width when expanded
      setContextChatWidth(chatWidth);
    } else {
      // Reset chat width when minimized to popup
      setContextChatWidth(0);
    }
  }, [state.isExpanded, setIsChatExpanded, setChatVisible, chatWidth, setContextChatWidth]);

  // Handle resizer drag for width adjustment
  useEffect(() => {
    if (!isDraggingResizer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(rawWidth, MIN_CHAT_WIDTH), MAX_CHAT_WIDTH, window.innerWidth);
      setChatWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingResizer(false);
      setIsDraggingResizerContext(false);
    };

    setIsDraggingResizerContext(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingResizer]);

  const handleToggleTab = (tab: 'timer' | 'chat') => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  const handleExpandChat = () => {
    if (state.activeTab === 'chat') {
      setMobileMoreOpen(false);
      setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
    }
  };

  const handleClosePopup = () => {
    setState(prev => ({ ...prev, isVisible: false }));
    setFloatingPanelOpen(false);
  };

  const handleShowPopup = () => {
    setMobileMoreOpen(false);
    setState(prev => ({ ...prev, isVisible: true }));
    setFloatingPanelOpen(true);
  };

  const handleStartTimer = () => {
    if (!selectedSubject) {
      // Require study context selection
      return;
    }
    const minutes = Math.max(1, Math.min(999, parseInt(minutesInput) || 25));
    timer.start(minutes, selectedSubject === 'general-studies' ? undefined : selectedSubject);
  };

  const handleMinimizeChat = () => {
    setState(prev => ({ ...prev, isExpanded: false }));
  };

  // Load or create a conversation for the timer chat
  const loadOrCreateConversation = async () => {
    if (!user || state.activeTab !== 'chat') return;

    setIsLoadingChat(true);
    try {
      // Try to get the last timer chat conversation
      const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .like('title', 'Timer Chat%')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (conversations && conversations.length > 0) {
        // Load existing conversation
        const convId = conversations[0].id;
        setCurrentConversationId(convId);

        // Fetch messages directly (no encryption RPC)
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        const formattedMessages: Message[] = (messages || []).map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        setChatMessages(formattedMessages);
      } else {
        // Create a new conversation
        const { data: newConv, error: convError } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: user.id,
            title: `Timer Chat - ${new Date().toLocaleDateString()}`,
          })
          .select()
          .single();

        if (convError) throw convError;
        setCurrentConversationId(newConv.id);
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      // Fall back to local state on error
      setCurrentConversationId(null);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Save a message to the database
  const saveMessageToDb = async (message: Message) => {
    if (!currentConversationId) return;

    try {
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversationId,
          role: message.role,
          content: message.content,
        });

      // Update conversation's updated_at timestamp
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversationId);
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
  };

  // Load conversations list
  const loadConversationsList = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .like('title', 'Timer Chat%')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations((data || []) as ChatConversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Create a new chat conversation
  const handleNewChat = async () => {
    if (!user) return;

    try {
      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: `Timer Chat - ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentConversationId(newConv.id);
      setChatMessages([]);
      setShowChatHistory(false);
      await loadConversationsList();
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  };

  // Load a previous conversation
  const handleLoadConversation = async (convId: string) => {
    try {
      setCurrentConversationId(convId);

      // Fetch messages directly (no encryption RPC)
      const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const formattedMessages: Message[] = (messages || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      setChatMessages(formattedMessages);
      setShowChatHistory(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Load conversation when chat tab becomes active
  useEffect(() => {
    if (state.activeTab === 'chat' && state.isVisible) {
      // Only reload if no conversation ID is set or if we're explicitly resetting
      if (!currentConversationId || chatMessages.length === 0) {
        loadOrCreateConversation();
        loadConversationsList();
      }
    }
  }, [state.activeTab, state.isVisible, user, currentConversationId]);

  // Listen for flashcard explanation requests (opens floating panel + new chat)
  useEffect(() => {
    const handleOpenFlashcardExplanation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const prompt = customEvent.detail?.prompt;

      if (prompt) {
        console.log('[TimerChatToggle] Received explanation prompt, opening chat...');

        // Force open the chat popup with correct state
        setState(prev => ({
          ...prev,
          activeTab: 'chat',
          isVisible: true,
          isExpanded: false,
        }));
        
        // Also set floating panel open
        setFloatingPanelOpen(true);

        // Wait for state update and then load conversation + set prompt
        setTimeout(async () => {
          try {
            if (!user) return;

            const { data: conversations, error } = await supabase
              .from('chat_conversations')
              .select('*')
              .eq('user_id', user.id)
              .like('title', 'Timer Chat%')
              .order('updated_at', { ascending: false })
              .limit(1);

            if (error) throw error;

            if (conversations && conversations.length > 0) {
              const convId = conversations[0].id;
              const { data: messages, error: msgError } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: true });

              if (msgError) throw msgError;

              const formattedMessages: Message[] = (messages || []).map(msg => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
              }));

              setCurrentConversationId(convId);
              setChatMessages(formattedMessages);
            } else {
              const { data: newConv, error: convError } = await supabase
                .from('chat_conversations')
                .insert({
                  user_id: user.id,
                  title: `Timer Chat - ${new Date().toLocaleDateString()}`,
                })
                .select()
                .single();

              if (convError) throw convError;

              setCurrentConversationId(newConv.id);
              setChatMessages([]);
            }
          } catch (err) {
            console.error('Error loading conversation:', err);
          }

          setAutoSendMessage(prompt);
        }, 400);
      }
    };

    // Listen for direct message sends (when expanded chat is already open)
    const handleSendChatMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const prompt = customEvent.detail?.prompt;
      if (prompt && isChatExpanded) {
        // Just set the auto-send message - the expanded chat will pick it up
        setAutoSendMessage(prompt);
      }
    };

    window.addEventListener('openFlashcardExplanation', handleOpenFlashcardExplanation);
    window.addEventListener('sendChatMessage', handleSendChatMessage);

    return () => {
      window.removeEventListener('openFlashcardExplanation', handleOpenFlashcardExplanation);
      window.removeEventListener('sendChatMessage', handleSendChatMessage);
    };
  }, [user, isChatExpanded]);

  // Clear autoSendMessage after it's been processed by SwipeableAiChat
  useEffect(() => {
    if (autoSendMessage && chatMessages.length > 0) {
      // Message has been added to the chat, clear autoSendMessage
      setTimeout(() => {
        setAutoSendMessage('');
      }, 500);
    }
  }, [autoSendMessage, chatMessages.length]);

  // Show button only when popup is hidden
  const showButton = !state.isVisible;

  return (
    <>
      {/* FLOATING BUTTON - Shows when popup is hidden */}
      <AnimatePresence mode="popLayout">
        {showButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 100, rotate: -45 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              rotate: 0,
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 25,
                mass: 1.2
              }
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
              y: 100,
              rotate: 45,
              transition: {
                duration: 0.3,
                ease: "anticipate"
              }
            }}
            whileHover={{
              scale: 1.15,
              rotate: [0, -10, 10, -10, 0],
              transition: { duration: 0.4 }
            }}
            whileTap={{ scale: 0.85 }}
            onClick={handleShowPopup}
            className={`fixed z-[70] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center ring-4 ring-primary/20 backdrop-blur-sm transition-all ${
              state.isExpanded ? 'bottom-24 right-6 lg:bottom-24' : 'bottom-20 right-6 lg:bottom-6'
            }`}
            title={state.activeTab === 'timer' ? 'Show Timer' : 'Show Chat'}
          >
            <motion.div
              key={state.activeTab + (state.seeTimer && timer.isRunning ? '-active' : '')}
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              {state.seeTimer && timer.isRunning ? (
                <span className="text-[10px] font-bold font-mono">
                  {timer.formattedTime}
                </span>
              ) : state.activeTab === 'timer' ? (
                <Timer className="w-6 h-6" />
              ) : (
                <MessageSquare className="w-6 h-6" />
              )}
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* FLOATING POPUP - Either Timer or Chat based on activeTab */}
      <AnimatePresence mode="wait">
        {state.isVisible && !state.isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 0.8,
              }
            }}
            exit={{
              opacity: 0,
              y: 40,
              scale: 0.9,
              transition: {
                duration: 0.2,
                ease: "easeIn"
              }
            }}
            className="fixed bottom-20 right-4 sm:right-6 lg:bottom-6 z-[70] w-72 sm:w-[400px] h-96 sm:h-[550px] bg-card/95 backdrop-blur-xl border border-primary/20 rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden ring-1 ring-white/10"
          >
            {/* Tab Toggle Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              {/* Timer Tab */}
              <motion.button
                onClick={() => handleToggleTab('timer')}
                whileHover={{ backgroundColor: 'var(--color-secondary)' }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 text-left ${
                  state.activeTab === 'timer'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Timer className="w-4 h-4" />
                <span className="text-sm font-medium">Timer</span>
              </motion.button>

              {/* Chat Tab */}
              <motion.button
                onClick={() => handleToggleTab('chat')}
                whileHover={{ backgroundColor: 'var(--color-secondary)' }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 text-left ${
                  state.activeTab === 'chat'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Chat</span>
              </motion.button>

              {/* Close Button */}
              <motion.button
                onClick={handleClosePopup}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {state.activeTab === 'timer' ? (
                  <motion.div
                    key="timer"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col h-full overflow-y-auto"
                  >
                    {/* Timer Display */}
                    <div className="p-4 border-b border-border bg-muted/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Timer className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('components.studyTimer')}</p>
                          <p className="text-2xl font-mono font-bold text-foreground">
                            {timer.formattedTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timer Controls */}
                    {!timer.isRunning ? (
                      <div className="p-4 space-y-4">
                        {/* Timer Duration Input */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Study Duration
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="999"
                              value={minutesInput}
                              onChange={(e) => setMinutesInput(e.target.value)}
                              className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-foreground text-sm"
                              placeholder="25"
                            />
                            <span className="text-sm text-muted-foreground font-medium">min</span>
                          </div>
                        </div>

                        {/* Subject Selector with General Studies */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Study Context
                          </label>
                          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select context" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.map((subject) => (
                                <SelectItem key={subject.id} value={subject.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: subject.color }}
                                    />
                                    {subject.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Start Button - Requires study context */}
                        <Button
                          onClick={handleStartTimer}
                          disabled={!selectedSubject}
                          className="w-full h-9"
                        >
                          <Timer className="w-4 h-4 mr-2" />
                          {!selectedSubject ? 'Select a study context first' : 'Start Timer'}
                        </Button>

                        {/* See Timer Toggle */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium">See Timer on Toggle</span>
                          </div>
                          <button
                            onClick={() => setState(prev => ({ ...prev, seeTimer: !prev.seeTimer }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              state.seeTimer ? 'bg-primary' : 'bg-input'
                            }`}
                          >
                            <span
                              className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                                state.seeTimer ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            onClick={timer.isPaused ? timer.resume : timer.pause}
                            className="h-9 w-9"
                          >
                            {timer.isPaused ? '▶' : '⏸'}
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={timer.stop}
                            className="h-9 w-9"
                          >
                            ⏹
                          </Button>
                        </div>

                        {/* See Timer Toggle when running */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium">See Timer on Toggle</span>
                          </div>
                          <button
                            onClick={() => setState(prev => ({ ...prev, seeTimer: !prev.seeTimer }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              state.seeTimer ? 'bg-primary' : 'bg-input'
                            }`}
                          >
                            <span
                              className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                                state.seeTimer ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Study Tip at the bottom */}
                    <div className="mt-auto p-4 bg-primary/5 border-t border-primary/10">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5">
                          <span className="text-sm">💡</span>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Study Tip</h4>
                          <p className="text-xs text-foreground leading-relaxed italic font-medium">
                            "{studyTip}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat-popup"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                  >
                    {/* Chat Header with Expand Button */}
                    <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">AI Assistant</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FreeTokenIndicator />
                        <motion.button
                          onClick={handleExpandChat}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1 hover:bg-secondary rounded-lg transition-colors"
                          title="Expand to sidebar"
                        >
                          <Maximize2 className="w-4 h-4 text-muted-foreground" />
                        </motion.button>
                      </div>
                    </div>

                    {/* Chat Content */}
                    <SwipeableAiChat
                      isOpen={true}
                      isExpanded={false}
                      messages={chatMessages}
                      onMessagesChange={setChatMessages}
                      onSaveMessage={saveMessageToDb}
                      autoSendMessage={autoSendMessage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPANDED CHAT SIDEBAR - Full right sidebar with resizer */}
      <AnimatePresence mode="wait">
        {state.isExpanded && state.activeTab === 'chat' && (
          <motion.div
            initial={{ x: chatWidth, opacity: 0 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: {
                type: 'spring',
                stiffness: 600,
                damping: 35,
                mass: 0.5,
              }
            }}
            exit={{
              x: chatWidth,
              opacity: 0,
              transition: {
                duration: 0.15,
                ease: "easeIn"
              }
            }}
            className="fixed right-0 top-0 left-0 lg:left-auto lg:right-0 bottom-0 w-full lg:w-auto h-dvh lg:h-full bg-card border-l border-border z-[60] flex flex-col overflow-hidden shadow-2xl origin-right"
            style={{ width: window.innerWidth <= 1024 ? '100vw' : `${chatWidth}px` }}
          >
            {/* Resizer Divider */}
            <div
              onMouseDown={() => setIsDraggingResizer(true)}
              className={`absolute left-0 top-0 bottom-0 z-50 w-1 cursor-col-resize hover:bg-primary transition-colors ${
                isDraggingResizer ? 'bg-primary' : 'bg-transparent hover:bg-primary/30'
              }`}
              title="Drag to resize chat panel"
            />
            {/* Header with controls */}
              <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">AI Assistant</span>
                  <FreeTokenIndicator />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <motion.button
                    onClick={handleNewChat}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 hover:bg-secondary rounded-lg transition-colors"
                    title="New chat"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  <motion.button
                    onClick={() => setShowChatHistory(!showChatHistory)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 hover:bg-secondary rounded-lg transition-colors"
                    title="Chat history"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  <motion.button
                    onClick={handleMinimizeChat}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 hover:bg-secondary rounded-lg transition-colors"
                    title="Collapse to popup"
                  >
                    <Minimize2 className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                </div>
              </div>

              {/* Chat History Sidebar */}
              <AnimatePresence mode="wait">
                {showChatHistory && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 z-50 bg-card flex flex-col"
                  >
                    {/* History Header */}
                    <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground">Chat History</span>
                      <motion.button
                        onClick={() => setShowChatHistory(false)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-1 hover:bg-secondary rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </motion.button>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {conversations.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center">
                          <p className="text-sm text-muted-foreground">No conversations yet</p>
                        </div>
                      ) : (
                        conversations.map((conv) => (
                          <motion.button
                            key={conv.id}
                            onClick={() => handleLoadConversation(conv.id)}
                            whileHover={{ backgroundColor: 'var(--color-secondary)' }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left p-3 rounded-lg transition-colors text-sm ${
                              currentConversationId === conv.id
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-secondary text-foreground'
                            }`}
                          >
                            <p className="font-medium truncate">{conv.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(conv.updated_at).toLocaleDateString()}
                            </p>
                          </motion.button>
                        ))
                      )}
                    </div>

                    {/* New Chat Button */}
                    <div className="p-3 border-t border-border flex-shrink-0">
                      <Button
                        onClick={handleNewChat}
                        className="w-full h-8 text-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        New Chat
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat Content */}
              <SwipeableAiChat
                isOpen={!showChatHistory}
                isExpanded={true}
                messages={chatMessages}
                onMessagesChange={setChatMessages}
                onSaveMessage={saveMessageToDb}
                autoSendMessage={autoSendMessage}
              />
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TimerChatToggle;
