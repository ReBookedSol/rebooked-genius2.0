import { useEffect } from 'react';
import { useAnimationContext } from '@/contexts/AnimationContext';

/**
 * Hook to manage page entry animations based on user preferences.
 * Animations play every time you visit a page if animations are enabled in preferences.
 * Respects the user's animation enable/disable setting.
 *
 * @param pageName - Unique identifier for the page (e.g., 'Flashcards', 'Dashboard')
 * @returns Object with:
 *   - shouldAnimate: boolean - whether animations should play (based on user preference)
 */
export const usePageAnimation = (pageName: string) => {
  const { animationsEnabled, markPageVisited } = useAnimationContext();

  useEffect(() => {
    // Mark this page as visited (used for analytics/tracking)
    markPageVisited(pageName);
  }, [pageName, markPageVisited]);

  return {
    shouldAnimate: animationsEnabled,
  };
};
