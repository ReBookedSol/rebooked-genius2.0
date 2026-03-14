import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPointsData {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  xpToNextLevel: number;
  lastActivityDate: string | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  category: string;
  points: number;
  is_premium?: boolean;
  unlock_animation_type?: string;
  unlocked_at?: string;
  requirement_type: string;
  requirement_value: number;
}

export const useUserPoints = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState<UserPointsData>({
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    level: 1,
    xpToNextLevel: 100,
    lastActivityDate: null,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPoints = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user points:', error);
        return;
      }

      if (data) {
        setPoints({
          totalPoints: data.total_points || 0,
          currentStreak: data.current_streak || 0,
          longestStreak: data.longest_streak || 0,
          level: data.level || 1,
          xpToNextLevel: data.xp_to_next_level || 100,
          lastActivityDate: data.last_activity_date,
        });
      } else {
        // Row not found, initialize user points
        const { error: insertError } = await supabase.from('user_points').insert({
          user_id: user.id,
          total_points: 0,
          current_streak: 0,
          longest_streak: 0,
          level: 1,
          xp_to_next_level: 100,
        });

        if (insertError) {
          console.error('Error creating user points:', insertError);
          return;
        }

        setPoints({
          totalPoints: 0,
          currentStreak: 0,
          longestStreak: 0,
          level: 1,
          xpToNextLevel: 100,
          lastActivityDate: null,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching user points:', errorMessage);
    }
  }, [user]);

  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all achievements
      const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*')
        .order('points', { ascending: true });

      if (allAchievements) {
        setAchievements(allAchievements);
      }

      // Fetch user's unlocked achievements
      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', user.id);

      if (userAchievements) {
        const unlocked = userAchievements.map((ua: any) => ({
          ...ua.achievements,
          unlocked_at: ua.unlocked_at,
        }));
        setUnlockedAchievements(unlocked);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching achievements:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserPoints();
    fetchAchievements();
  }, [fetchUserPoints, fetchAchievements]);

  const addPoints = useCallback(async (amount: number) => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentPoints = data?.total_points || 0;
      const newTotal = currentPoints + amount;
      const newXp = newTotal % 100;
      const newLevel = Math.floor(newTotal / 100) + 1;

      await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          total_points: newTotal,
          level: newLevel,
          xp_to_next_level: 100 - newXp,
          updated_at: new Date().toISOString(),
        });

      setPoints((prev) => ({
        ...prev,
        totalPoints: newTotal,
        level: newLevel,
        xpToNextLevel: 100 - newXp,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error adding points:', errorMessage);
    }
  }, [user]);

  const isAchievementUnlocked = useCallback((achievementId: string) => {
    return unlockedAchievements.some((a) => a.id === achievementId);
  }, [unlockedAchievements]);

  return {
    points,
    achievements,
    unlockedAchievements,
    loading,
    addPoints,
    isAchievementUnlocked,
    refreshPoints: fetchUserPoints,
    refreshAchievements: fetchAchievements,
  };
};
