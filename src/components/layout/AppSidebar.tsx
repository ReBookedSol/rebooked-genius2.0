import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  FileText,
  BarChart3,
  Bell,
  LogOut,
  Brain,
  Palette,
  ChevronRight,
  Zap,
  BookOpen,
  Map
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';

const AppSidebar = () => {
  const { isExpanded, setIsExpanded } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('nav.dashboard'), path: '/' },
    { icon: BookOpen, label: t('nav.knowledgeHub'), path: '/study' },
    { icon: Palette, label: t('nav.whiteboard'), path: '/whiteboard' },
    { icon: FileText, label: t('nav.pastPapers'), path: '/papers' },
    { icon: Zap, label: t('nav.nbtAssessment'), path: '/nbt' },
    { icon: BarChart3, label: t('nav.insights'), path: '/analytics' },
    { icon: Bell, label: t('nav.notifications'), path: '/notifications' },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: t('sidebar.signedOut'),
      description: t('sidebar.signedOutMessage'),
    });
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ')[0][0].toUpperCase()
    : user?.email?.split('@')[0][0].toUpperCase() || 'R';

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`fixed left-6 top-6 bottom-6 bg-card rounded-3xl shadow-soft flex flex-col items-start py-6 z-50 transition-all duration-300 ${
        isExpanded ? 'w-56' : 'w-20'
      }`}
    >
      {/* Logo */}
      <Link to="/" className="w-full mb-4 flex items-center justify-center transition-all duration-300">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0"
        >
          <Brain className="w-6 h-6 text-primary-foreground" />
        </motion.div>
      </Link>

      {/* Toggle Button */}
      <div className="w-full flex items-center justify-center mb-4 px-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300 flex-shrink-0"
          title={isExpanded ? t('sidebar.collapse') : t('sidebar.expand')}
        >
          <ChevronRight size={20} strokeWidth={1.8} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-none w-full min-h-0">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;

          return (
            <Link key={item.label} to={item.path} className="w-full px-2">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.03, duration: 0.3 }}
                whileHover={{ scale: isExpanded ? 1.02 : 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`h-12 rounded-2xl flex items-center gap-3 transition-all duration-300 ${
                  isExpanded ? 'justify-start px-2' : 'justify-center'
                } ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
                title={item.label}
              >
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <item.icon size={22} strokeWidth={1.8} />
                </div>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Spacer */}
      <div className="flex-shrink-0 h-2" />

      {/* Sign Out */}
      <motion.button
        whileHover={{ scale: isExpanded ? 1.02 : 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSignOut}
        className={`h-12 rounded-2xl flex items-center gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-300 mx-2 ${
          isExpanded ? 'w-auto px-4 justify-start' : 'w-12 justify-center'
        }`}
        title={t('sidebar.signOut')}
      >
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <LogOut size={22} strokeWidth={1.8} />
        </div>
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm font-medium whitespace-nowrap"
          >
            {t('sidebar.signOut')}
          </motion.span>
        )}
      </motion.button>

      {/* User Avatar */}
      <Link to="/settings" className="w-full px-2">
        <motion.div
          whileHover={{ scale: isExpanded ? 1.02 : 1.05 }}
          className={`h-12 rounded-2xl bg-accent-mint/20 overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all duration-300 flex items-center gap-3 ${
            isExpanded ? 'px-2 justify-start' : 'justify-center'
          }`}
        >
          <div className={`${isExpanded ? 'w-8 h-8' : 'w-8 h-8'} bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center flex-shrink-0 rounded-lg`}>
            <span className="text-primary font-semibold text-xs">{userInitials}</span>
          </div>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-medium text-foreground whitespace-nowrap truncate"
            >
              {t('streak.profile')}
            </motion.span>
          )}
        </motion.div>
      </Link>
    </motion.aside>
  );
};

export default AppSidebar;
