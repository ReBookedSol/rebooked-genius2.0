import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;

  // Right-side AI chat sidebar (desktop/expanded)
  isChatExpanded: boolean;
  setIsChatExpanded: (expanded: boolean) => void;

  // Legacy flag used by some components
  chatVisible: boolean;
  setChatVisible: (visible: boolean) => void;

  chatWidth: number;
  setChatWidth: (width: number) => void;

  // Mobile overlay coordination (prevents "More" + chat/timer overlays at same time)
  mobileMoreOpen: boolean;
  setMobileMoreOpen: (open: boolean) => void;

  floatingPanelOpen: boolean;
  setFloatingPanelOpen: (open: boolean) => void;

  isDraggingResizer: boolean;
  setIsDraggingResizer: (dragging: boolean) => void;

  // Study view flag to hide bottom nav
  isStudyView: boolean;
  setIsStudyView: (isStudy: boolean) => void;

  // Full-screen content mode
  isContentExpanded: boolean;
  setIsContentExpanded: (expanded: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isExpandedRaw, setIsExpandedState] = useState(false);
  const [isChatExpandedRaw, setIsChatExpandedState] = useState(false);
  const [chatVisible, setChatVisibleState] = useState(false);
  const [chatWidth, setChatWidthState] = useState(400);

  const [mobileMoreOpen, setMobileMoreOpenState] = useState(false);
  const [floatingPanelOpen, setFloatingPanelOpenState] = useState(false);
  const [isDraggingResizer, setIsDraggingResizer] = useState(false);
  const [isContentExpanded, setIsContentExpandedState] = useState(false);
  const [isStudyView, setIsStudyViewState] = useState(false);

  // Mutual exclusion: sidebar and AI chat can't both be open
  // Use requestAnimationFrame to batch state changes and prevent layout thrashing
  const setIsExpanded = (expanded: boolean) => {
    if (expanded && isChatExpandedRaw) {
      // First collapse chat, then expand sidebar in next frame
      setIsChatExpandedState(false);
      requestAnimationFrame(() => {
        setIsExpandedState(true);
      });
    } else {
      setIsExpandedState(expanded);
    }
  };

  const setIsChatExpanded = (expanded: boolean) => {
    if (expanded && isExpandedRaw) {
      // First collapse sidebar, then expand chat in next frame
      setIsExpandedState(false);
      requestAnimationFrame(() => {
        setIsChatExpandedState(true);
      });
    } else {
      setIsChatExpandedState(expanded);
    }
  };

  const setChatVisible = (visible: boolean) => {
    setChatVisibleState(visible);
  };

  const setChatWidth = (width: number) => {
    setChatWidthState(width);
    document.documentElement.style.setProperty('--chat-width', `${width}px`);
  };

  const setMobileMoreOpen = (open: boolean) => {
    setMobileMoreOpenState(open);
    if (open) {
      setFloatingPanelOpenState(false);
    }
  };

  const setFloatingPanelOpen = (open: boolean) => {
    setFloatingPanelOpenState(open);
    if (open) {
      setMobileMoreOpenState(false);
    }
  };

  const setIsContentExpanded = (expanded: boolean) => {
    setIsContentExpandedState(expanded);
  };

  const setIsStudyView = (isStudy: boolean) => {
    setIsStudyViewState(isStudy);
  };

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isExpandedRaw,
        setIsExpanded,
        isChatExpanded: isChatExpandedRaw,
        setIsChatExpanded,
        chatVisible,
        setChatVisible,
        chatWidth,
        setChatWidth,
        mobileMoreOpen,
        setMobileMoreOpen,
        floatingPanelOpen,
        setFloatingPanelOpen,
        isDraggingResizer,
        setIsDraggingResizer,
        isContentExpanded,
        setIsContentExpanded,
        isStudyView,
        setIsStudyView,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};
