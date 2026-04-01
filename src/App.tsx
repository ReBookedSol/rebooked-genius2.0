import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AnimationProvider, useAnimationContext } from "@/contexts/AnimationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AIContextProvider } from "@/contexts/AIContext";
import { LessonGenerationProvider } from "@/contexts/LessonGenerationContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AnimationReset } from "@/components/AnimationReset";
import TimerChatToggle from "@/components/TimerChatToggle";
import { LessonGenerationOverlay } from "@/components/study/LessonGenerationOverlay";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { Analytics } from "@vercel/analytics/react";

import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Study from "./pages/Study";
import Whiteboard from "./pages/Whiteboard";
import PastPapers from "./pages/PastPapers";
import Insights from "./pages/Analytics";
import Settings from "./pages/Settings";
import SettingsProfile from "./pages/SettingsProfile";
import SettingsBilling from "./pages/SettingsBilling";

import SettingsSupport from "./pages/SettingsSupport";
import Notifications from "./pages/Notifications";
import PaymentSuccess from "./pages/PaymentSuccess";
import NBT from "./pages/NBT";
import GraphPractice from "./pages/nbt/GraphPractice";
import NBTTestTaking from "./pages/nbt/NBTTestTaking";
import Admin from "./pages/Admin";
import Sitemap from "./pages/Sitemap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();
  const { animationsEnabled } = useAnimationContext();
  const location = useLocation();
  const isPaymentSuccess = location.pathname === '/payment-success';
  
  // Hide timer chat bubble on 404 page, payment success, and sitemap
  const knownPaths = [
    '/', '/auth', '/study', '/whiteboard', '/papers', 
    '/analytics', '/achievements', '/settings', 
    '/notifications', '/payment-success', '/nbt', 
    '/admin', '/sitemap.xml'
  ];
  
  const isNotFound = !knownPaths.some(path => 
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  );

  return (
    <MotionConfig reducedMotion={animationsEnabled ? "never" : "always"} transition={animationsEnabled ? undefined : { duration: 0 }}>
      <AnimationReset>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/study" element={<Study />} />
          <Route path="/study/:id" element={<Study />} />
          <Route path="/whiteboard" element={<Whiteboard />} />
          <Route path="/papers" element={<PastPapers />} />
          <Route path="/analytics" element={<Insights />} />
          <Route path="/achievements" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/profile" element={<SettingsProfile />} />
          <Route path="/settings/billing" element={<SettingsBilling />} />

          <Route path="/settings/support" element={<SettingsSupport />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/nbt" element={<NBT />} />
          <Route path="/nbt/graph-practice/:type" element={<GraphPractice />} />
          <Route path="/nbt/test/:testId" element={<NBTTestTaking />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/sitemap.xml" element={<Sitemap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimationReset>
      {user && !isPaymentSuccess && !isNotFound && <div data-animation-always><TimerChatToggle /></div>}
    </MotionConfig>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <AnimationProvider>
              <AIContextProvider>
                <LessonGenerationProvider>
                  <SidebarProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <AppContent />
                        <LessonGenerationOverlay />
                      </BrowserRouter>
                    </TooltipProvider>
                  </SidebarProvider>
                </LessonGenerationProvider>
              </AIContextProvider>
            </AnimationProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
    <Analytics />
  </ErrorBoundary>
);

export default App;
