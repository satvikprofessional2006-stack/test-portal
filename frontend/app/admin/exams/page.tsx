"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { examsApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  BookOpen, Plus, Search, Calendar, Clock,
  CheckCircle2, XCircle, Trash2, Edit3, Users, ChevronRight,
  Filter, PlayCircle
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
  is_archived: boolean;
  questions?: any[];
  enrollment_count?: number;
}

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "ended" | "draft">("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await examsApi.list();
      const list = res.data.results || res.data || [];
      setExams(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(id);
      await examsApi.delete(id);
      toast.success("Exam deleted successfully");
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to delete exam");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (exam: Exam) => {
    try {
      const updatedStatus = !exam.is_published;
      await examsApi.update(exam.id, { is_published: updatedStatus });
      toast.success(updatedStatus ? "Exam published!" : "Exam unpublished (draft)");
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, is_published: updatedStatus } : e))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to update status");
    }
  };

  const getStatus = (exam: Exam) => {
    if (!exam.is_published) return { label: "Draft", color: "text-slate-400 bg-slate-800/60 border-slate-700" };
    const now = new Date();
    const start = new Date(exam.scheduled_start);
    const end = new Date(exam.scheduled_end);
    if (now < start) return { label: "Upcoming", color: "text-blue-400 bg-blue-900/30 border-blue-700/50" };
    if (now >= start && now <= end) return { label: "Live Now", color: "text-emerald-400 bg-emerald-900/30 border-emerald-600/50 animate-pulse" };
    return { label: "Ended", color: "text-amber-400/80 bg-amber-950/30 border-amber-800/40" };
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.title.toLowerCase().includes(search.toLowerCase()) ||
      exam.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "draft") return !exam.is_published;
    const now = new Date();
    const start = new Date(exam.scheduled_start);
    const end = new Date(exam.scheduled_end);
    if (filter === "live") return exam.is_published && now >= start && now <= end;
    if (filter === "upcoming") return exam.is_published && now < start;
    if (filter === "ended") return exam.is_published && now > end;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Exams</h1>
          <p className="text-slate-500 mt-1 text-sm">Create, manage, and monitor examination papers</p>
        </div>
        <Link
          href="/admin/exams/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 w-fit"
        >
          <Plus className="w-4 h-4" /> Create Exam
        </Link>
      </div>

      {/* Filters and Search Bar */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams by title..."
            className="w-full pl-10 pr-4 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-500 hidden sm:block shrink-0" />
          {(["all", "live", "upcoming", "ended", "draft"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all shrink-0 ${
                filter === key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-[#1e2d47]/60"
              }`}
            >
              {key === "all" ? "All Exams" : key}
            </button>
          ))}
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No exams found</h3>
          <p className="text-slate-500 text-sm mt-1">
            {search || filter !== "all"
              ? "Try adjusting your search or status filter"
              : "Get started by creating your first exam paper"}
          </p>
          <Link
            href="/admin/exams/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Create Exam
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const status = getStatus(exam);
            const start = new Date(exam.scheduled_start);
            const end = new Date(exam.scheduled_end);
            const durationMin = Math.round(exam.duration_seconds / 60);

            return (
              <div
                key={exam.id}
                className="glass rounded-2xl p-5 border border-[#1e2d47] hover:border-blue-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className="text-base font-semibold text-slate-100 hover:text-blue-400 transition-colors line-clamp-1"
                    >
                      {exam.title}
                    </Link>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border shrink-0 ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                    {exam.description || "No description provided."}
                  </p>

                  {/* Metadata Chips */}
                  <div className="space-y-1.5 text-xs text-slate-400 mb-4 bg-[#0a0f1d]/60 p-3 rounded-xl border border-[#19243a]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {start.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                        {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                        {end.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                        {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{durationMin} mins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                        <span>{exam.questions?.length ?? 0} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{exam.enrollment_count ?? 0} Enrolled</span>
                      </div>
                    </div>
                  </div>

                  {/* Allowed Languages */}
                  {exam.allowed_languages && exam.allowed_languages.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {exam.allowed_languages.map((lang) => (
                        <span
                          key={lang}
                          className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950/40 text-blue-300/80 border border-blue-800/30"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#1e2d47]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePublish(exam)}
                      title={exam.is_published ? "Click to unpublish" : "Click to publish"}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        exam.is_published
                          ? "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                          : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
                      }`}
                    >
                      {exam.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id, exam.title)}
                      disabled={deletingId === exam.id}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <Link
                    href={`/admin/exams/${exam.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Manage Exam <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
