import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

export interface AIContextState {
  currentPage: string;
  activeDocument?: {
    id: string;
    name: string;
    subject?: string;
    type?: string;
    content?: string;
    is_past_paper?: boolean;
  } | null;
  activePaper?: {
    subject: string;
    year: string;
    paper: string;
  } | null;
  activeAnalytics?: {
    view: string;
    context?: string;
  } | null;
  activeFlashcard?: {
    id: string;
    front: string;
    back: string;
  } | null;
  location?: string;
}

interface AIContextType {
  context: AIContextState;
  setAiContext: (updates: Partial<AIContextState>) => void;
  resetContext: () => void;
}

const defaultState: AIContextState = {
  currentPage: 'home',
  activeDocument: null,
  activePaper: null,
  activeAnalytics: null,
  location: 'Home',
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [context, setContext] = useState<AIContextState>(defaultState);

  const setAiContext = useCallback((updates: Partial<AIContextState>) => {
    setContext((prev) => {
      // Basic check to see if anything actually changed to avoid unnecessary re-renders
      // Note: This is a shallow comparison for the top-level keys
      const changed = Object.entries(updates).some(([key, value]) => {
        return JSON.stringify(prev[key as keyof AIContextState]) !== JSON.stringify(value);
      });

      if (!changed) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const resetContext = useCallback(() => {
    setContext(defaultState);
  }, []);

  const value = useMemo(() => ({
    context,
    setAiContext,
    resetContext
  }), [context, setAiContext, resetContext]);

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};

export const useAIContext = () => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAIContext must be used within an AIContextProvider');
  }
  return context;
};
