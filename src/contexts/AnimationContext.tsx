import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface AnimationContextType {
  visitedPages: Set<string>;
  markPageVisited: (pageName: string) => void;
  isFirstVisit: (pageName: string) => boolean;
  resetAnimation: () => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => Promise<void>;
  loadingAnimationPreference: boolean;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

const ANIMATION_PREFERENCE_KEY = 'lovable_animations_enabled';

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set());
  const [animationsEnabled, setAnimationsEnabledState] = useState(true);
  const [loadingAnimationPreference, setLoadingAnimationPreference] = useState(true);

  // Load animation preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ANIMATION_PREFERENCE_KEY);
      if (stored !== null) {
        const enabled = stored === 'true';
        setAnimationsEnabledState(enabled);
        if (!enabled) {
          document.documentElement.classList.add('no-animations');
        } else {
          document.documentElement.classList.remove('no-animations');
        }
      }
    } catch (e) {
      console.warn('Failed to load animation preference:', e);
    }
    setLoadingAnimationPreference(false);
  }, [user?.id]);

  const markPageVisited = useCallback((pageName: string) => {
    setVisitedPages((prev) => new Set(prev).add(pageName));
  }, []);

  const isFirstVisit = useCallback((pageName: string) => {
    // If animations are disabled, always return false (no animation)
    if (!animationsEnabled) return false;
    return !visitedPages.has(pageName);
  }, [visitedPages, animationsEnabled]);

  const resetAnimation = useCallback(() => {
    setVisitedPages(new Set());
  }, []);

  const setAnimationsEnabled = useCallback(async (enabled: boolean) => {
    setAnimationsEnabledState(enabled);

    // Persist to localStorage
    try {
      localStorage.setItem(ANIMATION_PREFERENCE_KEY, String(enabled));
    } catch (e) {
      console.warn('Failed to save animation preference:', e);
    }

    // Apply global CSS class
    if (!enabled) {
      document.documentElement.classList.add('no-animations');
    } else {
      document.documentElement.classList.remove('no-animations');
    }

    // Reset visited pages to apply new preference immediately
    resetAnimation();
  }, [resetAnimation]);

  return (
    <AnimationContext.Provider
      value={{
        visitedPages,
        markPageVisited,
        isFirstVisit,
        resetAnimation,
        animationsEnabled,
        setAnimationsEnabled,
        loadingAnimationPreference,
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimationContext must be used within AnimationProvider');
  }
  return context;
};
