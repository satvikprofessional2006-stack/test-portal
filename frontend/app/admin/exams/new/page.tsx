"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { examsApi } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, BookOpen, Clock, Calendar, Check, Save } from "lucide-react";

const AVAILABLE_LANGUAGES = [
  { id: "python", label: "Python 3" },
  { id: "javascript", label: "JavaScript (Node)" },
  { id: "cpp", label: "C++ (GCC)" },
  { id: "c", label: "C (GCC)" },
  { id: "java", label: "Java 17" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
];

export default function NewExamPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "1. Read each question statement and input/output format carefully.\n2. You can run custom test cases using the Run button.\n3. Make sure to Submit before the timer expires.\n4. Switching tabs, leaving full-screen, or copy-pasting is strictly monitored."
  );
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([
    "python",
    "javascript",
    "cpp",
  ]);
  const [passingScore, setPassingScore] = useState(40);
  const [isPublished, setIsPublished] = useState(false);

  const toggleLanguage = (langId: string) => {
    setAllowedLanguages((prev) =>
      prev.includes(langId)
        ? prev.filter((id) => id !== langId)
        : [...prev, langId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an exam title");
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      toast.error("Please specify both start and end time");
      return;
    }

    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);

    if (endDate <= startDate) {
      toast.error("End time must be strictly after start time");
      return;
    }

    const durationSeconds = durationMinutes * 60;
    const windowSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
    if (durationSeconds > windowSeconds) {
      toast.error("Exam duration cannot exceed the overall scheduled window");
      return;
    }

    if (allowedLanguages.length === 0) {
      toast.error("Select at least one allowed programming language");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        duration_seconds: durationSeconds,
        allowed_languages: allowedLanguages,
        passing_score: passingScore,
        is_published: isPublished,
      };

      const res = await examsApi.create(payload);
      const newExam = res.data.data || res.data;
      toast.success("Exam paper created successfully!");
      router.push(`/admin/exams/${newExam.id}`);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.detail ||
        (typeof err.response?.data?.errors === "object"
          ? JSON.stringify(err.response.data.errors)
          : "Failed to create exam");
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        href="/admin/exams"
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Exams
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Create New Exam</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Set examination schedule, timing constraints, and language rules
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" /> Exam Information
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Exam Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms Midterm 2026"
              className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description / Overview
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown to students in their exam catalog..."
              className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              General Instructions
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Rules and instructions displayed to students upon entering the exam..."
              className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Schedule & Duration */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> Schedule & Time Limit
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Scheduled Window Start <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">Students cannot start before this time</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Scheduled Window End <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">Exam window closes strictly at this time</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Candidate Duration (Minutes) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min={5}
                max={600}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Individual countdown timer once student clicks "Start"
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Passing Score (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">Benchmark percentage required to pass</p>
            </div>
          </div>
        </div>

        {/* Allowed Languages */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3">
            Allowed Programming Languages
          </h2>
          <p className="text-xs text-slate-400">
            Select the languages students are permitted to use in the editor:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {AVAILABLE_LANGUAGES.map((lang) => {
              const selected = allowedLanguages.includes(lang.id);
              return (
                <button
                  type="button"
                  key={lang.id}
                  onClick={() => toggleLanguage(lang.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    selected
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-sm"
                      : "bg-[#0c1322] border-[#1e2d47] text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span>{lang.label}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Publish Status Toggle */}
        <div className="glass rounded-2xl p-5 border border-[#1e2d47] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Publish Immediately</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              If enabled, enrolled students will immediately see this exam in their portal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublished(!isPublished)}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              isPublished ? "bg-blue-600" : "bg-slate-700"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isPublished ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/exams"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-[#141c2e] transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30"
          >
            <Save className="w-4 h-4" />
            {submitting ? "Creating Exam..." : "Create & Add Questions →"}
          </button>
        </div>
      </form>
    </div>
  );
}
