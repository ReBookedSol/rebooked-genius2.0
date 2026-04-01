import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Home,
  ArrowLeft,
  Brain,
  Sparkles,
  SearchX,
  BookOpen,
  Zap,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative max-w-2xl w-full">
        <div className="text-center space-y-8">
          {/* Animated Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative inline-block"
          >
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-secondary/30 rounded-[2.5rem] flex items-center justify-center relative z-10 mx-auto border-2 border-border/50 shadow-2xl backdrop-blur-sm">
              <SearchX className="w-16 h-16 sm:w-20 sm:h-20 text-primary" />

              {/* Floating Decorative Icons */}
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 w-10 h-10 bg-background border border-border shadow-lg rounded-xl flex items-center justify-center text-primary"
              >
                <Sparkles className="w-5 h-5" />
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-2 -left-6 w-12 h-12 bg-background border border-border shadow-lg rounded-xl flex items-center justify-center text-primary"
              >
                <Brain className="w-6 h-6" />
              </motion.div>
            </div>

            {/* Background number 404 */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[120px] sm:text-[180px] font-black text-primary/[0.03] select-none z-0">
              404
            </div>
          </motion.div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <h1 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight italic uppercase italic">
              Route <span className="text-primary italic">Not Found</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground font-medium max-w-md mx-auto leading-relaxed italic">
              The page you are looking for has either been moved, or it never existed in this quadrant of the Rebooked Genius.
            </p>
          </motion.div>

          <div className="bg-muted/10 border-2 border-border/50 rounded-3xl p-6 sm:p-8 mt-12 grid gap-4 sm:grid-cols-2 max-w-xl mx-auto backdrop-blur-md">
            <div className="text-left space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 mb-2">Navigation Help</p>
              <p className="text-sm font-bold text-foreground italic flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Double check the URL
              </p>
              <p className="text-sm font-bold text-foreground italic flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Visit the Study Section
              </p>
            </div>
            <div className="text-left space-y-1 sm:border-l sm:pl-6 border-border/50">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1 mb-2">Search Logic</p>
              <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">
                If you are trying to access a specific study material, please ensure you are logged in.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate(-1)}
              className="h-14 px-8 rounded-2xl border-2 font-black text-lg gap-3 w-full sm:w-auto hover:bg-secondary/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              GO BACK
            </Button>
            <Link to="/" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/25 font-black text-lg gap-3 w-full group"
              >
                <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
                RETURN HOME
              </Button>
            </Link>
          </motion.div>

          <div className="flex items-center justify-center gap-3 pt-12">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">Rebooked Genius</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
