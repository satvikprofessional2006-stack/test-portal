"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { examsApi, authApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  BookOpen, Clock, Calendar, LogOut, Code2, ChevronRight,
  CheckCircle, AlertCircle, Timer, User
} from "lucide-react";

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

function ExamCard({ exam, onEnter }: { exam: Exam; onEnter: (id: number) => void }) {
  const start = new Date(exam.scheduled_start);
  const end = new Date(exam.scheduled_end);
  const now = new Date();
  const isActive = start <= now && now <= end;
  const isFuture = start > now;
  const isPast = end < now;

  const statusBadge = () => {
    if (exam.enrollment_status === "completed") return (
      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40">
        <CheckCircle className="w-3 h-3" /> Completed
      </span>
    );
    if (isActive) return (
      <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-700/40 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Live Now
      </span>
    );
    if (isFuture) return (
      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-700/40">
        <Timer className="w-3 h-3" /> Upcoming
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-900/30 px-2 py-0.5 rounded-full border border-slate-700/40">
        Ended
      </span>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 hover:border-blue-500/30 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {statusBadge()}
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mt-2 group-hover:text-blue-300 transition-colors">
            {exam.title}
          </h3>
          {exam.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{exam.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[#0f1629] rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Start
          </p>
          <p className="text-xs text-slate-300 font-medium">{start.toLocaleString()}</p>
        </div>
        <div className="bg-[#0f1629] rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Duration
          </p>
          <p className="text-xs text-slate-300 font-medium">{formatDuration(exam.duration_seconds)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">{exam.question_count} question{exam.question_count !== 1 ? 's' : ''}</span>
        <span className="text-slate-700">·</span>
        {exam.allowed_languages.map(lang => (
          <span key={lang} className="text-xs bg-[#0f1629] text-slate-400 px-2 py-0.5 rounded-md border border-[#1e2d47] font-mono">
            {lang}
          </span>
        ))}
      </div>

      <button
        onClick={() => onEnter(exam.id)}
        disabled={!isActive || exam.enrollment_status === "completed"}
        className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-[#1a2540] disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-900/30"
      >
        {exam.enrollment_status === "completed" ? (
          <><CheckCircle className="w-4 h-4" /> Completed</>
        ) : isActive ? (
          <><ChevronRight className="w-4 h-4" /> Enter Exam</>
        ) : isFuture ? (
          <><Timer className="w-4 h-4" /> Not Started</>
        ) : (
          <><AlertCircle className="w-4 h-4" /> Exam Ended</>
        )}
      </button>
    </div>
  );
}

export default function StudentExamsPage() {
  const router = useRouter();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "student") {
      router.replace("/login");
      return;
    }
    examsApi.myExams()
      .then(res => setExams(res.data.results || res.data.data || res.data || []))
      .catch(() => toast.error("Failed to load exams."))
      .finally(() => setLoading(false));
  }, [user, router]);

  const handleEnter = async (examId: number) => {
    router.push(`/student/exam/${examId}`);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    clearAuth();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[#1e2d47] bg-[#0a0e1a]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-blue-400" />
            </div>
            <span className="font-semibold text-slate-200">ExamPortal</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <User className="w-4 h-4" />
              <span>{user?.full_name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-200 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">My Exams</h1>
          <p className="text-slate-500 mt-1">Your enrolled examinations are listed below.</p>
        </div>

        {exams.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-400 font-medium">No exams assigned yet</h3>
            <p className="text-slate-600 text-sm mt-1">Contact your administrator to be enrolled in an exam.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {exams.map(exam => (
              <ExamCard key={exam.id} exam={exam} onEnter={handleEnter} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
