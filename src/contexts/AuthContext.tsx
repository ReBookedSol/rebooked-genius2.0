import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { updateUserStreak } from '@/utils/streak';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, redirectTo?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUpdatedRef = useRef<{userId: string, date: string} | null>(null);

  // Update streak on login/session restore
  const handleUserActivity = useCallback(async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // Deduplicate calls for the same user on the same day in this session
    if (lastUpdatedRef.current?.userId === userId && lastUpdatedRef.current?.date === today) {
      return;
    }

    try {
      console.log('[Auth] Updating streak for user on login:', userId);
      const success = await updateUserStreak(userId);
      if (success) {
        lastUpdatedRef.current = { userId, date: today };
      }
    } catch (error) {
      console.error('[Auth] Error updating streak:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Update streak on sign in
        if (event === 'SIGNED_IN' && session?.user) {
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(() => handleUserActivity(session.user.id), 100);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Update streak on session restore (page refresh while logged in)
      if (session?.user) {
        handleUserActivity(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [handleUserActivity]);

  const signUp = async (email: string, password: string, fullName: string, redirectTo?: string) => {
    const redirectUrl = redirectTo || `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
