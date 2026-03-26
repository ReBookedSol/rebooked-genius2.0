import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type SubscriptionTier = 'free' | 'tier1' | 'tier2';

export interface Subscription {
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
}

export interface TierLimits {
  aiMessagesPerDay: number;
  aiTokensPerDay: number;
  maxDocuments: number;
  maxPagesPerDocument: number;
  maxQuizQuestions: number;
  maxFlashcards: number;
  maxFlashcardSets: number;
  maxQuizSets: number;
  hasNbtAccess: boolean;
  hasPastPaperAi: boolean;
  hasDetailedAnalytics: boolean;
  hasAchievementRewards: boolean;
  hasYoutubeLesson: boolean;
  hasExams: boolean;
  aiModel: 'basic' | 'advanced';
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    aiMessagesPerDay: Infinity, // No message limit, use token limit instead
    aiTokensPerDay: 5000,
    maxDocuments: 2,
    maxPagesPerDocument: Infinity, // Remove page limit
    maxQuizQuestions: 10,
    maxFlashcards: 10,
    maxFlashcardSets: 5, // 5 total flashcard sets
    maxQuizSets: 5, // 5 total quiz sets
    hasNbtAccess: false,
    hasPastPaperAi: false,
    hasDetailedAnalytics: false,
    hasAchievementRewards: false,
    hasYoutubeLesson: false,
    hasExams: false,
    aiModel: 'basic',
  },
  tier1: {
    aiMessagesPerDay: Infinity,
    aiTokensPerDay: Infinity,
    maxDocuments: Infinity,
    maxPagesPerDocument: Infinity,
    maxQuizQuestions: 50,
    maxFlashcards: 50,
    maxFlashcardSets: Infinity,
    maxQuizSets: Infinity,
    hasNbtAccess: false,
    hasPastPaperAi: true,
    hasDetailedAnalytics: true,
    hasAchievementRewards: true,
    hasYoutubeLesson: true,
    hasExams: true,
    aiModel: 'advanced',
  },
  tier2: {
    aiMessagesPerDay: Infinity,
    aiTokensPerDay: Infinity,
    maxDocuments: Infinity,
    maxPagesPerDocument: Infinity,
    maxQuizQuestions: 50,
    maxFlashcards: 50,
    maxFlashcardSets: Infinity,
    maxQuizSets: Infinity,
    hasNbtAccess: true,
    hasPastPaperAi: true,
    hasDetailedAnalytics: true,
    hasAchievementRewards: true,
    hasYoutubeLesson: true,
    hasExams: true,
    aiModel: 'advanced',
  },
};

export interface UsageData {
  aiMessagesToday: number;
  aiTokensToday: number;
  documentCount: number;
  totalPagesProcessed: number;
  activeDaysCount: number;
  flashcardSetsCount: number;
  quizSetsCount: number;
}

export interface StorageData {
  totalBytesUsed: number;
  limitBytes: number;
  percentageUsed: number;
  canUploadBySize: (fileSize: number) => boolean;
}

const STORAGE_LIMITS: Record<SubscriptionTier, number> = {
  free: 20971520, // 20 MB
  tier1: 1073741824, // 1 GB
  tier2: 1073741824, // 1 GB
};

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscriptionData, isLoading: subLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [subResult, profileResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('profiles')
          .select('pre_registered_trial_started_at')
          .eq('user_id', user.id)
          .single()
      ]);

      const subData = subResult.data;
      const subError = subResult.error;

      if (subError && subError.code !== 'PGRST116' && subError.code !== '406') {
        console.error('Error fetching subscription:', subError);
      }

      const rawTier = (subData as any)?.tier as string || 'free';
      const status = (subData as any)?.status || 'active';
      const tier: SubscriptionTier = ['free', 'tier1', 'tier2'].includes(rawTier)
        ? rawTier as SubscriptionTier
        : 'free';

      const isPreRegTrialExpired = !!(profileResult.data as any)?.pre_registered_trial_started_at && tier === 'free';

      return {
        tier: (status === 'active' || status === 'non-renewing') ? tier : 'free',
        status,
        currentPeriodEnd: (subData as any)?.current_period_end
          ? new Date((subData as any).current_period_end)
          : null,
        cancelledAt: (subData as any)?.cancelled_at
          ? new Date((subData as any).cancelled_at)
          : null,
        isPreRegTrialExpired
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery({
    queryKey: ['usage', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];
      const { data: aiUsageData, error: aiError } = await supabase
        .from('ai_usage')
        .select('message_count, token_count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      // If no row exists for today (PGRST116) or other non-fatal errors, default to 0
      const aiMessages = (aiError && aiError.code !== 'PGRST116' && aiError.code !== '406')
        ? 0
        : (aiUsageData as any)?.message_count || 0;

      const aiTokens = (aiError && aiError.code !== 'PGRST116' && aiError.code !== '406')
        ? 0
        : (aiUsageData as any)?.token_count || 0;

      // Count active days THIS MONTH only (tokens don't stack, 5-day limit per month)
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

      const { count: activeDays } = await supabase
        .from('ai_usage')
        .select('date', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', firstOfMonthStr);

      const { count: flashcardSets } = await supabase
        .from('flashcard_decks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: quizSets } = await supabase
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: docUsageData, error: docError } = await supabase
        .from('document_usage')
        .select('document_count, total_pages_processed')
        .eq('user_id', user.id)
        .single();

      const docCount = (docError && docError.code !== 'PGRST116' && docError.code !== '406')
        ? 0
        : (docUsageData as any)?.document_count || 0;
      const pagesProcessed = (docError && docError.code !== 'PGRST116' && docError.code !== '406')
        ? 0
        : (docUsageData as any)?.total_pages_processed || 0;

      return {
        aiMessagesToday: aiMessages,
        aiTokensToday: aiTokens,
        documentCount: docCount,
        totalPagesProcessed: pagesProcessed,
        activeDaysCount: activeDays || 0,
        flashcardSetsCount: flashcardSets || 0,
        quizSetsCount: quizSets || 0,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds — keep fresh for token indicator
    refetchInterval: 1000 * 60, // auto-refresh every 60s
  });

  const { data: storageDataRaw, isLoading: storageLoading } = useQuery({
    queryKey: ['storage', user?.id, subscriptionData?.tier],
    queryFn: async () => {
      if (!user) return null;

      const tier = subscriptionData?.tier || 'free';
      const limitBytes = STORAGE_LIMITS[tier];

      const { data: storageData, error: storageError } = await supabase
        .from('storage_usage' as any)
        .select('total_bytes_used')
        .eq('user_id', user.id)
        .single() as { data: { total_bytes_used: number } | null; error: any };

      const totalBytesUsed = (!storageError || storageError.code === 'PGRST116' || storageError.code === '406')
        ? 0
        : (storageData as any)?.total_bytes_used || 0;

      return {
        totalBytesUsed,
        limitBytes,
        percentageUsed: limitBytes > 0 ? Math.round((totalBytesUsed / limitBytes) * 100) : 0,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const tier = subscriptionData?.tier || 'free';
  const limits = TIER_LIMITS[tier];
  const usage = usageData || {
    aiMessagesToday: 0,
    aiTokensToday: 0,
    documentCount: 0,
    totalPagesProcessed: 0,
    activeDaysCount: 0,
    flashcardSetsCount: 0,
    quizSetsCount: 0
  };

  const storage: StorageData | null = storageDataRaw ? {
    ...storageDataRaw,
    canUploadBySize: (fileSize: number) => (storageDataRaw.totalBytesUsed + fileSize) <= storageDataRaw.limitBytes,
  } : null;

  const isStorageFull = storage ? storage.totalBytesUsed >= storage.limitBytes : false;

  const canUseAi = useCallback(() => {
    if (isStorageFull) return false;
    if (tier !== 'free') return true;

    // Free users: 5,000 tokens per day, max 5 active days
    // Tokens do NOT stack across days
    // After 5 active days in the month, blocked until next month

    // Check if daily token limit is reached
    if (usage.aiTokensToday >= limits.aiTokensPerDay) return false;

    // Check if 5-day active usage period is exhausted
    if (usage.activeDaysCount > 5) return false;

    return true;
  }, [tier, usage.aiTokensToday, usage.activeDaysCount, limits.aiTokensPerDay, isStorageFull]);

  const canUploadDocument = useCallback(() => {
    if (isStorageFull) return false;
    if (tier !== 'free') return true;
    return usage.documentCount < limits.maxDocuments;
  }, [tier, usage.documentCount, limits.maxDocuments, isStorageFull]);

  const canCreateFlashcardSet = useCallback(() => {
    if (tier !== 'free') return true;
    return usage.flashcardSetsCount < limits.maxFlashcardSets;
  }, [tier, usage.flashcardSetsCount, limits.maxFlashcardSets]);

  const canCreateQuiz = useCallback(() => {
    if (tier !== 'free') return true;
    return usage.quizSetsCount < limits.maxQuizSets;
  }, [tier, usage.quizSetsCount, limits.maxQuizSets]);

  const canAccessNbt = useCallback(() => {
    return tier === 'tier2'; // Only premium (tier2) users can access NBT
  }, [tier]);

  const remainingAiMessages = useCallback(() => {
    if (tier !== 'free') return Infinity;
    // For free users, remaining is based on tokens not messages
    const remainingTokens = Math.max(0, limits.aiTokensPerDay - usage.aiTokensToday);
    // Estimate ~50 tokens per message for display purposes
    return Math.max(0, Math.floor(remainingTokens / 50));
  }, [tier, limits.aiTokensPerDay, usage.aiTokensToday]);

  const remainingDocuments = useCallback(() => {
    return Math.max(0, limits.maxDocuments - usage.documentCount);
  }, [limits.maxDocuments, usage.documentCount]);

  const incrementAiUsage = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await supabase.from('ai_usage').upsert({
        user_id: user.id,
        date: today,
        message_count: usage.aiMessagesToday + 1
      }, { onConflict: 'user_id,date' });
      queryClient.invalidateQueries({ queryKey: ['usage', user.id] });
    } catch (error) {
      console.warn('Error incrementing AI usage:', error);
    }
  }, [user, usage.aiMessagesToday, queryClient]);

  const incrementDocumentUsage = useCallback(async (pagesProcessed: number = 0) => {
    if (!user) return;
    try {
      await supabase.from('document_usage').upsert({
        user_id: user.id,
        document_count: usage.documentCount + 1,
        total_pages_processed: usage.totalPagesProcessed + pagesProcessed,
      }, { onConflict: 'user_id' });
      queryClient.invalidateQueries({ queryKey: ['usage', user.id] });
    } catch (error) {
      console.warn('Error incrementing document usage:', error);
    }
  }, [user, usage.documentCount, usage.totalPagesProcessed, queryClient]);

  const updateStorageOnDocumentUpload = useCallback(async (fileSize: number) => {
    if (!user) return;
    try {
      const { error } = await (supabase as any).rpc('update_storage_on_document_upload', {
        p_user_id: user.id,
        p_file_size: fileSize,
      });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['storage', user.id] });
      }
    } catch (error) {
      console.warn('Error updating storage:', error);
    }
  }, [user, queryClient]);

  const clearAllStorage = useCallback(async () => {
    if (!user) return;
    try {
      await (supabase as any).rpc('clear_user_storage', { p_user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ['storage', user.id] });
      queryClient.invalidateQueries({ queryKey: ['usage', user.id] });
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }, [user, queryClient]);

  return {
    subscription: subscriptionData || null,
    tier,
    limits,
    usage,
    storage,
    isStorageFull,
    loading: subLoading || usageLoading || storageLoading,
    canUseAi,
    canUploadDocument,
    canCreateFlashcardSet,
    canCreateQuiz,
    canAccessNbt,
    remainingAiMessages,
    remainingDocuments,
    incrementAiUsage,
    incrementDocumentUsage,
    updateStorageOnDocumentUpload,
    clearAllStorage,
    isPreRegTrialExpired: subscriptionData?.isPreRegTrialExpired || false,
    refetch: refetchSubscription,
    refetchUsage,
  };
}
