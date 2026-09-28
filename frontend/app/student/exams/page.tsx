"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { examsApi, authApi } from "@/lib/api";
import toast from "react-hot-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  BookOpen, Clock, Calendar, LogOut, ChevronRight,
  CheckCircle, AlertCircle, Timer, GraduationCap, Play,
  Code2, Sparkles, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Exam {
  id: number;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_seconds: number;
  allowed_languages: string[];
  is_published: boolean;
  enrollment_status: string;
  question_count: number;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StudentExamsPage() {
  const router = useRouter();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "admin") {
      router.replace("/admin/dashboard");
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

  const loadExams = async () => {
    try {
      setLoading(true);
      const res = await examsApi.myExams();
      const list = res.data.results || res.data || [];
      setExams(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load assigned examinations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "student") {
      loadExams();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    clearAuth();
    router.push("/login");
  };

  const handleEnterExam = (examId: number) => {
    router.push(`/student/exam/${examId}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* ── Top Header (copied from automatic-print-system Header.tsx) ── */}
      <header className="h-14 shrink-0 z-30 flex items-center justify-between bg-card/60 backdrop-blur-md text-foreground border-b border-border/60 px-5 shadow-xs transition-colors duration-200">
        <div className="flex items-center gap-3">
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
              <GraduationCap className="h-2.5 w-2.5 text-primary" />
              <p className="text-[11px] text-primary font-semibold leading-tight">
                Candidate Workspace
              </p>
            </div>
          </div>
        </div>

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
              {user.full_name[0]?.toUpperCase() || "S"}
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

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Greeting Banner */}
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" /> Examination Session Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Hello, {user.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
              Welcome to the computer lab examination system. Only assigned assessments for which you are officially registered will appear below.
            </p>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-xs font-semibold text-foreground font-mono">{user.email}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled Candidate</p>
          </div>
        </div>

        {/* Exams List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Assigned Examinations
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              {exams.length} paper{exams.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur-md p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">No examinations assigned</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                You do not have any active or upcoming examinations at this time. When a proctor registers you for a test, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {exams.map((exam) => {
                const start = new Date(exam.scheduled_start);
                const end = new Date(exam.scheduled_end);
                const now = new Date();
                const isActive = start <= now && now <= end && exam.is_published;
                const isFuture = start > now;
                const isPast = end < now;
                const isCompleted = exam.enrollment_status === "completed";

                return (
                  <div
                    key={exam.id}
                    className={cn(
                      "rounded-2xl border-2 border-border/60 bg-card/50 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-200",
                      isActive && !isCompleted
                        ? "border-primary/50 hover:border-primary hover:shadow-lg shadow-primary/5"
                        : "hover:border-border hover:shadow-sm"
                    )}
                  >
                    <div>
                      {/* Top Status */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">
                          ID: #{exam.id}
                        </span>

                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" /> Completed
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live Assessment
                          </span>
                        ) : isFuture ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Timer className="w-3.5 h-3.5" /> Upcoming
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                            Ended
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-lg font-bold tracking-tight text-foreground leading-snug">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {exam.description}
                        </p>
                      )}

                      {/* Metadata Details */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/50 text-xs">
                        <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-primary" /> Schedule Window
                          </p>
                          <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                            {start.toLocaleDateString([], { month: "short", day: "numeric" })} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary" /> Allowed Time
                          </p>
                          <p className="text-xs font-semibold text-foreground mt-0.5">
                            {formatDuration(exam.duration_seconds)}
                          </p>
                        </div>
                      </div>

                      {/* Allowed Languages */}
                      {exam.allowed_languages && exam.allowed_languages.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {exam.allowed_languages.map((lang) => (
                            <span
                              key={lang}
                              className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50"
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {exam.question_count} problem{exam.question_count !== 1 ? "s" : ""}
                      </span>

                      {isCompleted ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Exam Submitted ✓
                        </span>
                      ) : isActive ? (
                        <button
                          onClick={() => handleEnterExam(exam.id)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer group"
                        >
                          <span>Enter Examination</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ) : isFuture ? (
                        <span className="text-xs text-muted-foreground">
                          Starts {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Assessment closed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
