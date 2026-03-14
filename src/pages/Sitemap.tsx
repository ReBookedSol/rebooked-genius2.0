import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import { 
  Home, 
  BookOpen, 
  Palette, 
  FileText, 
  BarChart3, 
  Settings, 
  Bell, 
  Zap, 
  ShieldCheck, 
  User, 
  CreditCard, 
  HardDrive, 
  LifeBuoy,
  Lock,
  Mail,
  Map as MapIcon
} from 'lucide-react';

const Sitemap = () => {
  const routes = [
    {
      title: 'Main Navigation',
      links: [
        { name: 'Dashboard', path: '/', icon: Home },
        { name: 'Study Hub', path: '/study', icon: BookOpen },
        { name: 'Whiteboard', path: '/whiteboard', icon: Palette },
        { name: 'Past Papers', path: '/papers', icon: FileText },
        { name: 'Insights / Analytics', path: '/analytics', icon: BarChart3 },
        { name: 'NBT Assessment', path: '/nbt', icon: Zap },
        { name: 'Notifications', path: '/notifications', icon: Bell },
      ]
    },
    {
      title: 'Settings & Account',
      links: [
        { name: 'General Settings', path: '/settings', icon: Settings },
        { name: 'Profile Settings', path: '/settings/profile', icon: User },
        { name: 'Billing & Subscription', path: '/settings/billing', icon: CreditCard },
        { name: 'Storage Management', path: '/settings/storage', icon: HardDrive },
        { name: 'Support & Help', path: '/settings/support', icon: LifeBuoy },
      ]
    },
    {
      title: 'Authentication',
      links: [
        { name: 'Sign In / Sign Up', path: '/auth', icon: Lock },
        { name: 'Forgot Password', path: '/auth/forgot-password', icon: Mail },
        { name: 'Reset Password', path: '/auth/reset-password', icon: ShieldCheck },
      ]
    }
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <MapIcon className="w-8 h-8 text-primary" />
            sitemap.xml
          </h1>
          <p className="text-muted-foreground mt-2">All pages and sections of the application</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {routes.map((section) => (
            <Card key={section.title} className="overflow-hidden border-none shadow-sm">
              <CardHeader className="bg-secondary/30">
                <CardTitle className="text-lg font-bold">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.path}>
                      <Link 
                        to={link.path}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group text-foreground font-medium"
                      >
                        <div className="p-1.5 rounded-md bg-background shadow-sm text-primary group-hover:scale-110 transition-transform">
                          <link.icon size={18} />
                        </div>
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Sitemap;
