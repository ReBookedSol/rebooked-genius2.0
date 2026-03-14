import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = async () => {
    if (isTransitioning) return; // Prevent rapid clicking

    setIsTransitioning(true);

    // Add a small delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 100));

    setTheme(theme === "dark" ? "light" : "dark");

    // Wait for theme change to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    setIsTransitioning(false);
  };

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={handleThemeToggle}
      disabled={isTransitioning}
      className="rounded-lg transition-opacity duration-200 p-1 lg:p-2 hover:bg-secondary/50 flex-shrink-0"
      title="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 lg:w-4 lg:h-4" />
      ) : (
        <Moon className="w-4 h-4 lg:w-4 lg:h-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
