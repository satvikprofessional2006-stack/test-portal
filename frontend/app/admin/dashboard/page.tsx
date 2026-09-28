"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { examsApi, sessionsApi, submissionsApi } from "@/lib/api";
import { BookOpen, Users, Activity, BarChart3, Plus, ChevronRight, Clock, TrendingUp } from "lucide-react";

interface Stats {
  totalExams: number;
  activeSessions: number;
  totalSubmissions: number;
  pendingJudge: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalExams: 0, activeSessions: 0, totalSubmissions: 0, pendingJudge: 0 });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      examsApi.list().catch(() => ({ data: [] })),
      sessionsApi.activeSessions().catch(() => ({ data: { data: [], count: 0 } })),
      submissionsApi.adminList().catch(() => ({ data: { count: 0 } })),
    ]).then(([examsRes, sessionsRes, subsRes]) => {
      const exams = examsRes.data.results || examsRes.data || [];
      setRecentExams(exams.slice(0, 5));
      setStats({
        totalExams: exams.length,
        activeSessions: sessionsRes.data.count || sessionsRes.data.data?.length || 0,
        totalSubmissions: subsRes.data.count || 0,
        pendingJudge: 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  const StatCard = ({ icon: Icon, label, value, color, href }: any) => (
    <Link href={href} className="glass rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-3xl font-bold text-slate-100 mb-1">{loading ? "—" : value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      <div className="flex items-center gap-1 text-xs text-slate-600 mt-3 group-hover:text-blue-400 transition-colors">
        View all <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">Platform overview and quick actions</p>
        </div>
        <Link
          href="/admin/exams/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus className="w-4 h-4" /> New Exam
        </Link>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard icon={BookOpen} label="Total Exams" value={stats.totalExams} color="bg-blue-600/20 text-blue-400" href="/admin/exams" />
        <StatCard icon={Activity} label="Active Sessions" value={stats.activeSessions} color="bg-emerald-600/20 text-emerald-400" href="/admin/sessions" />
        <StatCard icon={BarChart3} label="Submissions" value={stats.totalSubmissions} color="bg-purple-600/20 text-purple-400" href="/admin/submissions" />
        <StatCard icon={TrendingUp} label="Pending Judge" value={stats.pendingJudge} color="bg-yellow-600/20 text-yellow-400" href="/admin/submissions" />
      </div>

      {/* Recent Exams */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d47]">
          <h2 className="font-semibold text-slate-200">Recent Exams</h2>
          <Link href="/admin/exams" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl skeleton" />
            ))}
          </div>
        ) : recentExams.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No exams yet.</p>
            <Link href="/admin/exams/new" className="text-blue-400 text-xs mt-2 inline-block hover:text-blue-300">
              Create your first exam →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#1e2d47]">
            {recentExams.map(exam => {
              const start = new Date(exam.scheduled_start);
              const end = new Date(exam.scheduled_end);
              const now = new Date();
              const isActive = start <= now && now <= end;
              return (
                <Link key={exam.id} href={`/admin/exams/${exam.id}`} className="flex items-center px-6 py-4 hover:bg-[#141c2e] transition-colors group">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-blue-300 transition-colors">{exam.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{start.toLocaleDateString()} — {end.toLocaleDateString()}</p>
                  </div>
                  {isActive && (
                    <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40 mr-3 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
