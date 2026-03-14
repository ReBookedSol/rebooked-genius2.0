import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnimationContext } from '@/contexts/AnimationContext';

/**
 * Component that resets animations when user logs out.
 * This ensures animations play again on next login.
 */
export const AnimationReset = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { resetAnimation } = useAnimationContext();

  useEffect(() => {
    // Reset animations when user logs out (user becomes null)
    if (user === null) {
      resetAnimation();
    }
  }, [user, resetAnimation]);

  return <>{children}</>;
};
