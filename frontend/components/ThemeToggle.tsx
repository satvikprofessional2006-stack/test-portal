"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all cursor-pointer p-0 shrink-0 select-none shadow-sm",
        className
      )}
      title="Toggle Light / Dark theme"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4 text-amber-300 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 text-slate-700 transition-transform duration-300" />
        )
      ) : (
        <Sun className="h-4 w-4 opacity-50" />
      )}
    </button>
  );
}
