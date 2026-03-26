import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const isPreRegMode = new Date() < new Date('2026-04-01');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  // Handle redirect if in pre-registration mode
  if (isPreRegMode) {
    // If logged in but in pre-reg mode, show success page
    if (user) {
      return <Navigate to="/pre-register/success" replace />;
    }
    // If not logged in and in pre-reg mode, show pre-register page
    return <Navigate to="/pre-register" replace />;
  }

  // Normal mode: require auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
