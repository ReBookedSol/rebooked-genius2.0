import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useAIContext } from '@/contexts/AIContext';
import AppLayout from '@/components/layout/AppLayout';
import SettingsSidebar from '@/components/layout/SettingsSidebar';
import StorageManagement from '@/components/StorageManagement';

const SettingsStorage = () => {
  const { shouldAnimate } = usePageAnimation('SettingsStorage');
  const { setAiContext } = useAIContext();

  useEffect(() => {
    setAiContext({
      currentPage: 'settings',
      location: 'Storage Management',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [setAiContext]);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your storage usage and delete items to free up space</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <SettingsSidebar />

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            <StorageManagement />
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default SettingsStorage;
