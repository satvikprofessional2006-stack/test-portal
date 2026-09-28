"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { examsApi, sessionsApi, submissionsApi } from "@/lib/api";
import {
  BookOpen, Users, Activity, BarChart3, Plus,
  ChevronRight, Clock, ShieldCheck, ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  totalExams: number;
  activeSessions: number;
  totalSubmissions: number;
  pendingJudge: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalExams: 0,
    activeSessions: 0,
    totalSubmissions: 0,
    pendingJudge: 0,
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      examsApi.list().catch(() => ({ data: [] })),
      sessionsApi.activeSessions().catch(() => ({ data: { data: [], count: 0 } })),
      submissionsApi.adminList().catch(() => ({ data: { count: 0 } })),
    ])
      .then(([examsRes, sessionsRes, subsRes]) => {
        const exams = examsRes.data.results || examsRes.data || [];
        setRecentExams(exams.slice(0, 5));
        setStats({
          totalExams: exams.length,
          activeSessions: sessionsRes.data.count || sessionsRes.data.data?.length || 0,
          totalSubmissions: subsRes.data.count || 0,
          pendingJudge: 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statItems = [
    {
      label: "Total Exams",
      value: stats.totalExams,
      sub: "Exam papers created",
      icon: BookOpen,
      href: "/admin/exams",
    },
    {
      label: "Active Sessions",
      value: stats.activeSessions,
      sub: "Live candidates now",
      icon: Activity,
      href: "/admin/sessions",
    },
    {
      label: "Submissions",
      value: stats.totalSubmissions,
      sub: "Graded code submissions",
      icon: BarChart3,
      href: "/admin/submissions",
    },
    {
      label: "Security Audit",
      value: "Online",
      sub: "Proctoring active",
      icon: ShieldCheck,
      href: "/admin/security",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Summary of examination activity and candidate proctoring across all computer labs.
          </p>
        </div>
        <Link
          href="/admin/exams/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md w-fit cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Exam Paper
        </Link>
      </div>

      {/* Stat Cards (from automatic-print-system StatCards.tsx pattern) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={idx}
              href={item.href}
              className="border border-border/60 bg-card/50 hover:bg-card/80 hover:border-primary/50 backdrop-blur-md rounded-2xl shadow-xs p-5 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl shrink-0 bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground/80 font-medium">{item.label}</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                    {loading ? "—" : item.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.sub}</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Recent Exams Table / Card */}
      <div className="border border-border/60 bg-card/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Recent Examinations
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled papers, candidate enrollment counts, and live status.
            </p>
          </div>
          <Link
            href="/admin/exams"
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            View all exams →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : recentExams.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No examinations scheduled yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create an exam paper with programming problems and test cases.
            </p>
            <Link
              href="/admin/exams/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Create Exam
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentExams.map((exam) => {
              const start = new Date(exam.scheduled_start);
              const end = new Date(exam.scheduled_end);
              const now = new Date();
              const isLive = start <= now && now <= end && exam.is_published;

              return (
                <Link
                  key={exam.id}
                  href={`/admin/exams/${exam.id}`}
                  className="flex items-center px-6 py-4 hover:bg-primary/5 transition-colors group cursor-pointer"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2.5">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {exam.title}
                      </p>
                      {isLive && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span>
                        {start.toLocaleDateString([], { month: "short", day: "numeric" })} —{" "}
                        {end.toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                      <span>•</span>
                      <span>{Math.round(exam.duration_seconds / 60)} mins</span>
                      <span>•</span>
                      <span>{exam.enrollment_count ?? 0} enrolled</span>
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
