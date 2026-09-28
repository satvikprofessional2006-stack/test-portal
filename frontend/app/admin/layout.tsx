"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard, BookOpen, Users, Activity,
  Shield, BarChart3, LogOut, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/exams", icon: BookOpen, label: "Exams" },
  { href: "/admin/students", icon: Users, label: "Students Roster" },
  { href: "/admin/sessions", icon: Activity, label: "Live Sessions" },
  { href: "/admin/submissions", icon: BarChart3, label: "Submissions" },
  { href: "/admin/security", icon: Shield, label: "Security Logs" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/student/exams");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const tick = () =>
      setTimeStr(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    clearAuth();
    router.push("/login");
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex flex-col font-sans">
      {/* ── Top Header (copied from automatic-print-system Header.tsx) ── */}
      <header className="h-14 shrink-0 z-30 flex items-center justify-between bg-card/60 backdrop-blur-md text-foreground border-b border-border/60 px-5 shadow-xs transition-colors duration-200">
        {/* Logo */}
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-3 hover:opacity-85 transition-opacity cursor-pointer"
        >
          <img
            src="/Rishihood_University_idxo_lfgcw_2.png"
            alt="RU Logo"
            className="h-8 w-8 object-contain"
          />
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight text-foreground">
              RU Exam Portal
            </p>
            <div className="flex items-center gap-1.5">
              <Shield className="h-2.5 w-2.5 text-primary" />
              <p className="text-[11px] text-primary font-semibold leading-tight">
                Admin Control Panel
              </p>
            </div>
          </div>
        </Link>

        {/* Right Header items */}
        <div className="flex items-center gap-3">
          {timeStr && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 px-3 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {timeStr}
            </div>
          )}

          <ThemeToggle />

          <div className="flex items-center gap-2.5 pl-2 border-l border-border/40 ml-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-sm shrink-0">
              {user.full_name[0]?.toUpperCase() || "A"}
            </div>
            <span className="hidden md:block text-xs font-semibold text-foreground">
              {user.full_name}
            </span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Body with Sidebar ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        {/* Desktop Sidebar (copied from automatic-print-system Sidebar.tsx) */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col bg-card/30 backdrop-blur-md border-r border-border/60 select-none h-full overflow-hidden">
          <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto min-h-0">
            <p className="px-2 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Navigation
            </p>
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all text-left outline-none cursor-pointer",
                    active
                      ? "text-primary font-bold bg-primary/10 border border-primary/20 shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-3 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground/60 text-center tracking-wide font-medium">
              Rishihood University Examination System
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
