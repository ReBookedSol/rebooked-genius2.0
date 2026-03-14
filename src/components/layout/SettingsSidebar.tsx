import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  User,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const SettingsSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems: SettingsNavItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5" />,
      path: '/settings/profile',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="w-5 h-5" />,
      path: '/settings/billing',
    },
    {
      id: 'support',
      label: 'Support',
      icon: <HelpCircle className="w-5 h-5" />,
      path: '/settings/support',
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block sticky top-24 h-fit transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        <div className="flex justify-center mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 rounded-full hover:bg-secondary"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        <nav className="space-y-2">
          {navItems.map((item, index) => {
            const active = isActive(item.path);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex-shrink-0">{item.icon}</div>
                  {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              </motion.div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Navigation Dropdown */}
      <div className="lg:hidden mb-6">
        <Select value={navItems.find(item => isActive(item.path))?.id || 'profile'} onValueChange={(value) => {
          const item = navItems.find(i => i.id === value);
          if (item) navigate(item.path);
        }}>
          <SelectTrigger className="w-full md:max-w-md md:mx-auto md:block">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="center">
            {navItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

export default SettingsSidebar;
