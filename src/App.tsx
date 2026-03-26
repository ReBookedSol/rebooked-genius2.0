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
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { AnimationReset } from "@/components/AnimationReset";
import TimerChatToggle from "@/components/TimerChatToggle";
import { LessonGenerationOverlay } from "@/components/study/LessonGenerationOverlay";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";

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
import PreRegister from "./pages/PreRegister";
import PreRegisterSuccess from "./pages/PreRegisterSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();
  const { animationsEnabled } = useAnimationContext();
  const location = useLocation();
  const isPaymentSuccess = location.pathname === '/payment-success';
  

  const isPreRegister = location.pathname.startsWith('/pre-register');

  return (
    <MotionConfig reducedMotion={animationsEnabled ? "never" : "always"} transition={animationsEnabled ? undefined : { duration: 0 }}>
      <AnimationReset>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/pre-register" element={<PreRegister />} />
          <Route path="/pre-register/success" element={<PreRegisterSuccess />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          {/* Chat page removed - AI chat available via sidebar timer panel */}
          <Route path="/study" element={<ProtectedRoute><Study /></ProtectedRoute>} />
          <Route path="/study/:id" element={<ProtectedRoute><Study /></ProtectedRoute>} />
          <Route path="/whiteboard" element={<ProtectedRoute><Whiteboard /></ProtectedRoute>} />
          <Route path="/papers" element={<ProtectedRoute><PastPapers /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/achievements" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/settings/profile" element={<ProtectedRoute><SettingsProfile /></ProtectedRoute>} />
          <Route path="/settings/billing" element={<ProtectedRoute><SettingsBilling /></ProtectedRoute>} />
          
          <Route path="/settings/support" element={<ProtectedRoute><SettingsSupport /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/nbt" element={
            <ProtectedRoute>
              <NBT />
            </ProtectedRoute>
          } />
          <Route path="/nbt/graph-practice/:type" element={
            <ProtectedRoute>
              <GraphPractice />
            </ProtectedRoute>
          } />
          <Route path="/nbt/test/:testId" element={
            <ProtectedRoute>
              <NBTTestTaking />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/sitemap.xml" element={<Sitemap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimationReset>
      {user && !isPaymentSuccess && !isPreRegister && <div data-animation-always><TimerChatToggle /></div>}
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
  </ErrorBoundary>
);

export default App;
