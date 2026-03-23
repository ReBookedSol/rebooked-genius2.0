import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  BookOpen,
  FileText,
  BarChart3,
  Palette,
  Bell,
  MoreHorizontal,
  X,
  Zap,
  Settings,
  LogOut,
  Map
} from 'lucide-react';
import AppSidebar from './AppSidebar';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useAnimationContext } from '@/contexts/AnimationContext';
import { supabase } from '@/integrations/supabase/client';

interface AppLayoutProps {
  children: ReactNode;
  noPadding?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, noPadding = false }) => {
  const { isExpanded, isChatExpanded, chatWidth, isDraggingResizer, isContentExpanded, isStudyView } = useSidebar();
  const { animationsEnabled } = useAnimationContext();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  // Handle responsive sidebar width
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate sidebar width with padding
  const sidebarWidthValue = (isDesktop && !isContentExpanded) ? (isExpanded ? 224 : 80) : 0;
  const totalSidebarSpace = sidebarWidthValue + (isDesktop && !isContentExpanded ? 24 : 0);

  return (
    <div
      className="flex flex-col bg-background"
      style={{
        '--chat-width': `${isChatExpanded ? chatWidth : 0}px`,
        width: '100%',
        position: 'relative',
        height: '100vh',
        minHeight: '-webkit-fill-available',
      } as React.CSSProperties}
    >
      {/* Main Layout Container - Flex Row */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block flex-shrink-0">
          <AppSidebar />
        </div>

        {/* Main Content Area - Scrollable */}
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-none"
          style={{
            marginLeft: isDesktop ? `${totalSidebarSpace}px` : '0',
            marginRight: isDesktop && isChatExpanded ? `${chatWidth}px` : '0',
            transition: animationsEnabled && !isDraggingResizer ?
              'margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)' :
              'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          <div
            className={noPadding ? "w-full h-full" : "p-4 sm:p-6 md:p-8 pb-36 md:pb-8 mx-auto w-full"}
            style={{
              maxWidth: noPadding ? 'none' : 'none',
              transition: animationsEnabled && !isDraggingResizer && !noPadding ? 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              ...(noPadding ? { height: '100%' } : {})
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {!isStudyView && <MobileNav />}
    </div>
  );
};

const MobileNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { setLanguage } = useLanguage();
  const { mobileMoreOpen, setMobileMoreOpen, floatingPanelOpen, setFloatingPanelOpen } = useSidebar();
  const { animationsEnabled } = useAnimationContext();

  // Sync language from profile once
  useEffect(() => {
    const syncLanguage = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.language && (data.language === 'en' || data.language === 'af')) {
          const profileLanguage = data.language as 'en' | 'af';
          // Only update if different from current to avoid unnecessary re-renders
          const currentLanguage = localStorage.getItem('language');
          if (profileLanguage !== currentLanguage) {
            setLanguage(profileLanguage);
          }
        }
      } catch (err) {
        console.error('[AppLayout] Error syncing language:', err);
      }
    };

    syncLanguage();
  }, [user, setLanguage]);

  const mobileNavItems = [
    { icon: Home, label: t('nav.dashboard'), path: '/' },
    { icon: BookOpen, label: t('nav.knowledgeHub'), path: '/study' },
    { icon: Palette, label: t('nav.whiteboard'), path: '/whiteboard' },
    { icon: FileText, label: t('nav.pastPapers'), path: '/papers' },
    { icon: Zap, label: t('nav.nbtAssessment'), path: '/nbt' },
    { icon: BarChart3, label: t('nav.insights'), path: '/analytics' },
    { icon: Bell, label: t('nav.notifications'), path: '/notifications' },
  ];

  // Show first 4 items + "More" button
  const visibleItems = mobileNavItems.slice(0, 4);
  const moreItems = mobileNavItems.slice(4);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: t('sidebar.signedOut'),
        description: t('sidebar.signedOutMessage'),
      });
      setMobileMoreOpen(false);
      navigate('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSettings = () => {
    setMobileMoreOpen(false);
    navigate('/settings');
  };

  const toggleMore = () => {
    const next = !mobileMoreOpen;
    setMobileMoreOpen(next);
    if (next && floatingPanelOpen) {
      setFloatingPanelOpen(false);
    }
  };

  return (
    <>
      {/* Expanded Menu */}
      <AnimatePresence>
        {mobileMoreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 bg-card border-t border-border px-4 py-3 z-[101] shadow-card"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-foreground">{t('common.moreOptions')}</span>
              <button
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMoreOpen(false)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="text-[10px] text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}

              {/* Settings */}
              <button
                onClick={handleSettings}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <Settings size={20} />
                <span className="text-[10px] text-center leading-tight">{t('nav.settings')}</span>
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <LogOut size={20} />
                <span className="text-[10px] text-center leading-tight">{t('sidebar.signOut')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Nav Bar */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-2 z-[101] pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${animationsEnabled ? 'bg-card/95 backdrop-blur-md' : 'bg-card'}`}
      >
        <div className="flex justify-around items-center">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon size={22} />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={toggleMore}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors ${
              mobileMoreOpen ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MoreHorizontal size={22} />
            <span className="text-[10px]">{t('common.more')}</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default AppLayout;
