"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { examsApi, usersApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, BookOpen, Clock, Calendar, Users, Plus,
  Trash2, Edit3, CheckCircle2, AlertCircle, FileCode, Check,
  ExternalLink, BarChart2, ShieldAlert
} from "lucide-react";

interface TestCase {
  id: number;
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  time_limit_ms: number;
  memory_limit_mb: number;
  order: number;
}

interface Question {
  id: number;
  order: number;
  title: string;
  statement: string;
  marks: number;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages: string[];
  test_cases?: TestCase[];
}

interface Enrollment {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  roll_number: string;
  status: string;
  final_score: number | null;
  enrolled_at: string;
}

interface StudentUser {
  id: number;
  email: string;
  full_name: string;
  roll_number?: string;
}

export default function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const resolvedParams = use(params);
  const examId = parseInt(resolvedParams.examId);
  const router = useRouter();

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"questions" | "students" | "settings">("questions");

  // Enrollments & students state
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentUser[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  // Settings form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const res = await examsApi.get(examId);
      const current = res.data.data || res.data;

      if (!current || !current.id) {
        toast.error("Exam not found");
        router.push("/admin/exams");
        return;
      }

      setExam(current);
      setEditTitle(current.title || "");
      setEditDescription(current.description || "");
      setEditInstructions(current.instructions || "");

      // Load enrollments
      try {
        const enrRes = await examsApi.enrollments(examId);
        setEnrollments(enrRes.data.results || enrRes.data || []);
      } catch {}
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load exam");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamDetails();
  }, [examId]);

  const handleTogglePublish = async () => {
    if (!exam) return;
    try {
      const updated = !exam.is_published;
      await examsApi.update(exam.id, { is_published: updated });
      toast.success(updated ? "Exam published!" : "Exam saved as draft");
      setExam((prev: any) => ({ ...prev, is_published: updated }));
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to update status");
    }
  };

  const handleDeleteQuestion = async (qId: number, qTitle: string) => {
    if (!window.confirm(`Delete question "${qTitle}"?`)) return;
    try {
      await examsApi.deleteQuestion(examId, qId);
      toast.success("Question deleted");
      setExam((prev: any) => ({
        ...prev,
        questions: prev.questions.filter((q: any) => q.id !== qId),
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to delete question");
    }
  };

  const openEnrollModal = async () => {
    setShowEnrollModal(true);
    try {
      const res = await usersApi.list({ role: "student" });
      const students = res.data.results || res.data || [];
      setAvailableStudents(students);
      setSelectedStudentIds([]);
    } catch {
      toast.error("Failed to load students roster");
    }
  };

  const handleEnrollSubmit = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    try {
      setEnrolling(true);
      await examsApi.enrollStudents(examId, selectedStudentIds);
      toast.success(`Enrolled ${selectedStudentIds.length} students!`);
      setShowEnrollModal(false);
      // Refresh enrollments
      const enrRes = await examsApi.enrollments(examId);
      setEnrollments(enrRes.data.results || enrRes.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to enroll students");
    } finally {
      setEnrolling(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await examsApi.update(examId, {
        title: editTitle,
        description: editDescription,
        instructions: editInstructions,
      });
      toast.success("Exam details updated!");
      setExam((prev: any) => ({
        ...prev,
        title: editTitle,
        description: editDescription,
        instructions: editInstructions,
      }));
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 rounded-xl skeleton" />
        <div className="h-44 rounded-2xl skeleton" />
        <div className="h-96 rounded-2xl skeleton" />
      </div>
    );
  }

  if (!exam) return null;

  const start = new Date(exam.scheduled_start);
  const end = new Date(exam.scheduled_end);
  const now = new Date();
  const isLive = exam.is_published && now >= start && now <= end;
  const questions: Question[] = exam.questions || [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back button */}
      <Link
        href="/admin/exams"
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Exams
      </Link>

      {/* Header Banner */}
      <div className="glass rounded-2xl p-6 border border-[#1e2d47] mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">{exam.title}</h1>
              {isLive ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-600/50 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live Now
                </span>
              ) : exam.is_published ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-700/50">
                  Published
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">{exam.description || "No description."}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePublish}
              className={`text-xs px-3.5 py-2 rounded-xl border font-medium transition-all ${
                exam.is_published
                  ? "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                  : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
              }`}
            >
              {exam.is_published ? "Unpublish (Draft)" : "Publish Exam"}
            </button>
            <Link
              href={`/admin/sessions?exam_id=${exam.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Live Monitor
            </Link>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#1e2d47] text-xs">
          <div>
            <p className="text-slate-500">Duration</p>
            <p className="font-semibold text-slate-200 mt-0.5">
              {Math.round(exam.duration_seconds / 60)} minutes
            </p>
          </div>
          <div>
            <p className="text-slate-500">Scheduled Time</p>
            <p className="font-semibold text-slate-200 mt-0.5">
              {start.toLocaleDateString([], { month: "short", day: "numeric" })} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Questions</p>
            <p className="font-semibold text-slate-200 mt-0.5">{questions.length} problems</p>
          </div>
          <div>
            <p className="text-slate-500">Enrolled Students</p>
            <p className="font-semibold text-slate-200 mt-0.5">{enrollments.length} candidates</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1e2d47] mb-6">
        <button
          onClick={() => setActiveTab("questions")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "questions"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Questions ({questions.length})
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "students"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" /> Enrolled Students ({enrollments.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "settings"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Edit3 className="w-4 h-4" /> Exam Settings
        </button>
      </div>

      {/* Tab: Questions */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Exam questions ordered by sequence. Each problem can have public and hidden test cases.
            </p>
            <Link
              href={`/admin/exams/${examId}/questions/new`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-900/30"
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </Link>
          </div>

          {questions.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
              <FileCode className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-slate-200">No questions added yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add programming problems with problem statements, starter codes, and test cases.
              </p>
              <Link
                href={`/admin/exams/${examId}/questions/new`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Question
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="glass rounded-2xl p-5 border border-[#1e2d47] flex items-center justify-between gap-4 hover:border-blue-500/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                      Q{q.order || idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{q.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{q.marks} Marks</span>
                        <span>•</span>
                        <span>{q.test_cases?.length || 0} Test Cases</span>
                        <span>•</span>
                        <span>Time Limit: {q.time_limit_ms}ms</span>
                        <span>•</span>
                        <span>Memory: {q.memory_limit_mb}MB</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteQuestion(q.id, q.title)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Enrolled Students */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Students permitted to take this exam. You can enroll candidates individually or in bulk.
            </p>
            <button
              onClick={openEnrollModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-900/30"
            >
              <Plus className="w-3.5 h-3.5" /> Enroll Students
            </button>
          </div>

          {enrollments.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-medium text-slate-200">No students enrolled yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Enroll candidates from your student roster so they can see and access this exam.
              </p>
              <button
                onClick={openEnrollModal}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Enroll Candidates
              </button>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden border border-[#1e2d47]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b1220] border-b border-[#1e2d47] text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Candidate Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Roll Number</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d47]">
                  {enrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-[#141c2e] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-200">{enr.student_name}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono">{enr.student_email}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono">
                        {enr.roll_number || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                            enr.status === "completed"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                              : enr.status === "started"
                              ? "bg-blue-950/40 text-blue-400 border border-blue-800/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {enr.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-200">
                        {enr.final_score !== null ? `${enr.final_score} pts` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
          <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Exam Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instructions for Candidates
              </label>
              <textarea
                rows={5}
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-900/30"
              >
                {savingSettings ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Enroll Students Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-xl border border-[#1e2d47] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Enroll Students</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select registered candidates to grant exam access
                </p>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-500 hover:text-slate-300 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto divide-y divide-[#1e2d47]">
              {availableStudents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No registered student accounts found. Add students in the Students tab first.
                </p>
              ) : (
                <>
                  <div className="pb-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{availableStudents.length} Students Available</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudentIds(
                          selectedStudentIds.length === availableStudents.length
                            ? []
                            : availableStudents.map((s) => s.id)
                        )
                      }
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {selectedStudentIds.length === availableStudents.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                  {availableStudents.map((student) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    const alreadyEnrolled = enrollments.some((e) => e.student === student.id);

                    return (
                      <div
                        key={student.id}
                        onClick={() => {
                          if (alreadyEnrolled) return;
                          setSelectedStudentIds((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== student.id)
                              : [...prev, student.id]
                          );
                        }}
                        className={`py-2.5 px-3 flex items-center justify-between rounded-xl cursor-pointer transition-colors ${
                          alreadyEnrolled
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-blue-600/10 border border-blue-500/20"
                            : "hover:bg-[#141c2e]"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {student.full_name}{" "}
                            {student.roll_number && (
                              <span className="font-mono text-slate-500">
                                ({student.roll_number})
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{student.email}</p>
                        </div>
                        {alreadyEnrolled ? (
                          <span className="text-[10px] text-slate-500 font-medium">Already Enrolled</span>
                        ) : (
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-slate-600"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {selectedStudentIds.length} candidate(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedStudentIds.length === 0 || enrolling}
                  onClick={handleEnrollSubmit}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-5 py-2 rounded-xl transition-all shadow-md shadow-blue-900/30"
                >
                  {enrolling ? "Enrolling..." : "Enroll Selected"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
