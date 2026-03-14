import { supabase } from '@/integrations/supabase/client';

/**
 * Gets today's date in YYYY-MM-DD format using local timezone
 * This ensures consistency across all streak calculations
 */
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets yesterday's date in YYYY-MM-DD format using local timezone
 */
function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

/**
 * Parses a date string (YYYY-MM-DD) to local date for comparison
 */
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Updates the user's streak based on their last activity date.
 * Should be called after any learning activity (quiz, study session, flashcard, etc.)
 *
 * Timezone-safe implementation:
 * - Uses local timezone for all date comparisons
 * - Stores dates as YYYY-MM-DD strings for consistency
 */
export const updateUserStreak = async (userId: string): Promise<boolean> => {
  if (!userId) {
    console.error('[Streak] No userId provided');
    return false;
  }

  try {
    console.log('[Streak] Updating streak for user:', userId);

    // Get today's date in local timezone
    const todayStr = getLocalDateString();
    const yesterdayStr = getYesterdayDateString();

    console.log('[Streak] Today:', todayStr, 'Yesterday:', yesterdayStr);

    // Fetch current user points
    const { data: userPoints, error: fetchError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      const errorMessage = {
        message: fetchError.message,
        code: (fetchError as any).code,
        details: (fetchError as any).details,
      };
      console.error('[Streak] Error fetching user points:', errorMessage);
      throw fetchError;
    }

    // If user_points doesn't exist, create it with streak = 1
    if (!userPoints) {
      console.log('[Streak] Creating new user_points record');
      const { error: insertError } = await supabase
        .from('user_points')
        .insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_activity_date: todayStr,
          total_points: 0,
          level: 1,
          xp_to_next_level: 100,
        });

      if (insertError) {
        const errorMessage = {
          message: insertError.message,
          code: (insertError as any).code,
          details: (insertError as any).details,
        };
        console.error('[Streak] Error creating user points:', errorMessage);
        return false;
      }
      
      console.log('[Streak] Created new record with streak = 1');
      return true;
    }

    // Get last activity date - normalize to YYYY-MM-DD format
    let lastActivityDateStr: string | null = null;
    if (userPoints.last_activity_date) {
      // Handle both ISO datetime strings and YYYY-MM-DD strings
      const rawDate = String(userPoints.last_activity_date);
      if (rawDate.includes('T')) {
        // ISO datetime - parse and convert to local date
        const date = new Date(rawDate);
        lastActivityDateStr = getLocalDateString(date);
      } else {
        // Already in YYYY-MM-DD format
        lastActivityDateStr = rawDate.split(' ')[0]; // Handle any trailing time/timezone
      }
    }

    console.log('[Streak] Last activity:', lastActivityDateStr, 'Today:', todayStr, 'Yesterday:', yesterdayStr);

    // If activity was already recorded today, don't update streak
    if (lastActivityDateStr === todayStr) {
      console.log('[Streak] Already logged activity today, skipping update');
      return true;
    }

    // Calculate new streak
    let newStreak = 1;
    let newLongestStreak = userPoints.longest_streak || 0;

    if (lastActivityDateStr) {
      // If last activity was yesterday, increment the streak
      if (lastActivityDateStr === yesterdayStr) {
        newStreak = (userPoints.current_streak || 0) + 1;
        console.log('[Streak] Continuing streak:', newStreak);
      } else {
        console.log('[Streak] Streak broken (last activity was', lastActivityDateStr, '), resetting to 1');
      }
    } else {
      console.log('[Streak] First activity, starting streak at 1');
    }

    // Update longest streak if current streak is higher
    if (newStreak > newLongestStreak) {
      newLongestStreak = newStreak;
    }

    // Update user points with new streak data
    const { error: updateError } = await supabase
      .from('user_points')
      .update({
        current_streak: newStreak,
        longest_streak: newLongestStreak,
        last_activity_date: todayStr,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Streak] Error updating user streak:', {
        message: updateError.message,
        code: (updateError as any).code,
        details: (updateError as any).details,
      });
      return false;
    }

    console.log('[Streak] Successfully updated streak to:', newStreak, 'longest:', newLongestStreak);
    return true;
  } catch (error) {
    let errorDetails: any = '[object Object]';
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = {
        ...error,
        message: (error as any).message || 'Unknown error',
        code: (error as any).code,
        details: (error as any).details,
      };
    } else {
      errorDetails = String(error);
    }
    console.error('[Streak] Error updating user streak:', errorDetails);
    return false;
  }
};

/**
 * Records a study activity and updates the streak
 * Call this when user completes a quiz, flashcard session, or any learning activity
 */
export const recordStudyActivity = async (userId: string, activityType: string = 'general', subjectId: string | null = null): Promise<boolean> => {
  if (!userId) return false;

  console.log('[Streak] Recording activity:', activityType, 'for user:', userId, 'subject:', subjectId);

  try {
    // Update the streak
    const streakUpdated = await updateUserStreak(userId);

    // Also update study analytics for today
    const todayStr = getLocalDateString();

    const { data: existingAnalytics } = await supabase
      .from('study_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .eq('subject_id', subjectId)
      .maybeSingle();

    if (existingAnalytics) {
      // Update existing record
      await supabase
        .from('study_analytics')
        .update({
          sessions_count: (existingAnalytics.sessions_count || 0) + 1,
        })
        .eq('id', existingAnalytics.id);
    } else {
      // Create new record
      await supabase
        .from('study_analytics')
        .insert({
          user_id: userId,
          date: todayStr,
          subject_id: subjectId,
          sessions_count: 1,
          total_study_minutes: 0,
          average_score: 0,
        });
    }

    return streakUpdated;
  } catch (error) {
    let errorDetails: any = '[object Object]';
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = {
        ...error,
        message: (error as any).message || 'Unknown error',
        code: (error as any).code,
        details: (error as any).details,
      };
    } else {
      errorDetails = String(error);
    }
    console.error('[Streak] Error recording study activity:', errorDetails);
    return false;
  }
};

/**
 * Gets the current streak for a user
 * Useful for displaying streak information without updating it
 */
export const getUserStreak = async (userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
} | null> => {
  if (!userId) return null;

  try {
    const { data: userPoints, error } = await supabase
      .from('user_points')
      .select('current_streak, longest_streak, last_activity_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Streak] Error fetching user streak:', errorMessage);
      return null;
    }

    if (!userPoints) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
      };
    }

    return {
      currentStreak: userPoints.current_streak || 0,
      longestStreak: userPoints.longest_streak || 0,
      lastActivityDate: userPoints.last_activity_date ? String(userPoints.last_activity_date) : null,
    };
  } catch (error) {
    let errorDetails: any = '[object Object]';
    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else if (typeof error === 'object' && error !== null) {
      errorDetails = {
        ...error,
        message: (error as any).message || 'Unknown error',
        code: (error as any).code,
        details: (error as any).details,
      };
    } else {
      errorDetails = String(error);
    }
    console.error('[Streak] Error fetching user streak:', errorDetails);
    return null;
  }
};
