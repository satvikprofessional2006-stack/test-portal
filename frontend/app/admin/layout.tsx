"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import {
  LayoutDashboard, BookOpen, Users, Activity,
  Shield, BarChart3, Code2, LogOut, ChevronRight, Menu, X
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/exams", icon: BookOpen, label: "Exams" },
  { href: "/admin/students", icon: Users, label: "Students" },
  { href: "/admin/sessions", icon: Activity, label: "Live Sessions" },
  { href: "/admin/submissions", icon: BarChart3, label: "Submissions" },
  { href: "/admin/security", icon: Shield, label: "Security Events" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "admin") { router.replace("/student/exams"); return; }
  }, [user, router]);

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch {}
    clearAuth();
    router.push("/login");
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} border-r border-[#1e2d47] bg-[#0f1629] flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[#1e2d47] gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Code2 className="w-4 h-4 text-blue-400" />
          </div>
          {sidebarOpen && <span className="font-bold text-slate-200 text-sm">ExamPortal Admin</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-slate-600 hover:text-slate-300 transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-[#141c2e]"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-[#1e2d47] p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center text-xs text-blue-300 font-medium shrink-0">
                {user.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{user.full_name}</p>
                <p className="text-xs text-slate-600">Administrator</p>
              </div>
              <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-slate-600 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
