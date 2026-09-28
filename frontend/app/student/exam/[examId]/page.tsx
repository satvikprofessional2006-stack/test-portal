"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/store";
import { sessionsApi, submissionsApi, examsApi, securityApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Play, Send, Save, ChevronLeft, ChevronRight,
  Clock, Code2, CheckCircle, XCircle, AlertCircle,
  Terminal, BookOpen, Loader2, LogOut
} from "lucide-react";

// Monaco loaded dynamically (SSR-safe)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  id: number;
  order: number;
  title: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  notes: string;
  sample_input: string;
  sample_output: string;
  sample_explanation: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  marks: number;
  allowed_languages: string[] | null;
  sample_test_cases: { id: number; input_data: string; expected_output: string }[];
}

interface Exam {
  id: number;
  title: string;
  instructions: string;
  duration_seconds: number;
  allowed_languages: string[];
  questions: Question[];
}

interface Session {
  id: number;
  seconds_remaining: number;
  status: string;
  expires_at: string;
}

const LANG_MAP: Record<string, string> = {
  cpp17: "cpp",
  python3: "python",
  java: "java",
};

const LANG_DEFAULT: Record<string, string> = {
  cpp17: `#include <bits/stdc++.h>
using namespace std;
int main() {
    // your code here
    return 0;
}`,
  python3: `# your code here
`,
  java: `import java.util.*;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // your code here
    }
}`,
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const labels: Record<string, string> = {
    accepted: "Accepted", wrong_answer: "Wrong Answer",
    tle: "TLE", mle: "MLE", compilation_error: "Compilation Error",
    runtime_error: "Runtime Error", pending: "Pending", running: "Running...",
    internal_error: "Internal Error", ole: "Output Limit Exceeded",
  };
  return (
    <span className={`verdict-${verdict} text-xs px-2.5 py-1 rounded-full font-medium`}>
      {labels[verdict] || verdict}
    </span>
  );
}

export default function ExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  // Exam state
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [language, setLanguage] = useState("python3");
  const [code, setCode] = useState<Record<string, Record<string, string>>>({}); // {qId: {lang: code}}
  const [stdin, setStdin] = useState("");

  // UI panels
  const [outputTab, setOutputTab] = useState<"output" | "verdict">("output");
  const [runOutput, setRunOutput] = useState<any>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Autosave
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const autosaveRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const question = exam?.questions[currentQ];

  // ─── Initialise ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== "student") { router.replace("/login"); return; }
    initExam();
  }, [examId]);

  const initExam = async () => {
    try {
      // Enter/resume session
      const sessionRes = await sessionsApi.enter(Number(examId));
      const sessionData = sessionRes.data.data;
      setSession(sessionData);
      setSecondsLeft(sessionData.seconds_remaining);

      // Fetch exam details
      const examRes = await examsApi.examDetail(Number(examId));
      const examData = examRes.data.data;
      setExam(examData);

      // Load saved drafts for first question
      if (examData.questions.length > 0) {
        const q0 = examData.questions[0];
        await loadDraft(q0.id, examData.allowed_languages[0]);
      }

      setLoading(false);
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.detail || "Failed to enter exam.";
      toast.error(msg);
      router.push("/student/exams");
    }
  };

  const loadDraft = async (questionId: number, defaultLang: string) => {
    try {
      const res = await sessionsApi.drafts(questionId);
      const drafts: any[] = res.data.data || [];
      const primary = drafts.find(d => d.is_primary_language) || drafts[0];
      if (primary) {
        setLanguage(primary.language);
        setCode(prev => ({
          ...prev,
          [questionId]: { ...(prev[questionId] || {}), [primary.language]: primary.code },
        }));
      } else {
        setLanguage(defaultLang);
      }
    } catch {}
  };

  // ─── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Sync timer with server every 60s
    const syncTimer = setInterval(async () => {
      try {
        const res = await sessionsApi.timer();
        setSecondsLeft(res.data.data.seconds_remaining);
        if (res.data.data.status === "timed_out") {
          handleTimeExpired();
        }
      } catch {}
    }, 60000);

    return () => {
      clearInterval(timerRef.current!);
      clearInterval(syncTimer);
    };
  }, [session]);

  // ─── Heartbeat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    heartbeatRef.current = setInterval(async () => {
      try {
        await sessionsApi.heartbeat({ current_question_order: currentQ + 1 });
      } catch {}
    }, 30000);
    return () => clearInterval(heartbeatRef.current!);
  }, [session, currentQ]);

  // ─── Autosave ───────────────────────────────────────────────────────────────
  const triggerAutosave = useCallback(async () => {
    if (!question) return;
    const currentCode = code[question.id]?.[language] || "";
    setSaveStatus("saving");
    try {
      await sessionsApi.autosave({
        question_id: question.id,
        language,
        code: currentCode,
        is_primary_language: true,
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }, [question, language, code]);

  useEffect(() => {
    setSaveStatus("unsaved");
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(triggerAutosave, 3000);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  }, [code, language]);

  // ─── Security events ────────────────────────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        securityApi.logEvent("tab_switch", { hidden: true });
      }
    };
    const onBlur = () => securityApi.logEvent("window_blur", {});
    const onCopy = () => securityApi.logEvent("copy_detected", {});
    const onPaste = (e: ClipboardEvent) => {
      // Allow paste in editor but log it
      securityApi.logEvent("paste_detected", { length: e.clipboardData?.getData("text").length });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleTimeExpired = async () => {
    toast.error("Time's up! Exam has ended.", { duration: 5000 });
    securityApi.logEvent("exam_time_expired", {});
    setTimeout(() => router.push("/student/exams"), 3000);
  };

  const handleQuestionChange = async (index: number) => {
    await triggerAutosave(); // Save before switching
    setCurrentQ(index);
    setRunOutput(null);
    setSubmitResult(null);
    if (exam) {
      await loadDraft(exam.questions[index].id, exam.allowed_languages[0]);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (question && !code[question.id]?.[lang]) {
      setCode(prev => ({
        ...prev,
        [question.id]: { ...(prev[question.id] || {}), [lang]: LANG_DEFAULT[lang] || "" },
      }));
    }
  };

  const currentCode = question ? (code[question.id]?.[language] || LANG_DEFAULT[language] || "") : "";

  const handleCodeChange = (value: string | undefined) => {
    if (!question) return;
    setCode(prev => ({
      ...prev,
      [question.id]: { ...(prev[question.id] || {}), [language]: value || "" },
    }));
  };

  const handleRun = async () => {
    if (!question) return;
    setRunLoading(true);
    setOutputTab("output");
    try {
      const res = await submissionsApi.run({
        question_id: question.id,
        language,
        code: currentCode,
        stdin,
      });
      const runId = res.data.data.run_request_id;
      // Poll for result
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await submissionsApi.runStatus(runId);
          const data = statusRes.data.data;
          if (data.verdict !== "pending" && data.verdict !== "running") {
            clearInterval(poll);
            setRunOutput(data);
            setRunLoading(false);
          }
        } catch { clearInterval(poll); setRunLoading(false); }
        if (attempts > 30) { clearInterval(poll); setRunLoading(false); }
      }, 1000);
    } catch (err: any) {
      toast.error("Run failed. Please try again.");
      setRunLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!question) return;
    if (!window.confirm(`Submit your ${language} solution for "${question.title}"?`)) return;
    setSubmitLoading(true);
    setOutputTab("verdict");
    triggerAutosave();
    try {
      const res = await submissionsApi.submit({
        question_id: question.id,
        language,
        code: currentCode,
      });
      const subId = res.data.data.submission_id;
      toast.success("Submitted! Judging...");
      // Poll for verdict
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await submissionsApi.status(subId);
          const data = statusRes.data.data;
          if (data.verdict !== "pending" && data.verdict !== "running") {
            clearInterval(poll);
            setSubmitResult(data);
            setSubmitLoading(false);
            if (data.verdict === "accepted") {
              toast.success("✅ Accepted! Great job!", { duration: 4000 });
            } else {
              toast.error(`${data.verdict.replace(/_/g, " ")}`, { duration: 3000 });
            }
          }
        } catch { clearInterval(poll); setSubmitLoading(false); }
        if (attempts > 60) { clearInterval(poll); setSubmitLoading(false); }
      }, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.detail || "Submission failed.";
      toast.error(msg);
      setSubmitLoading(false);
    }
  };

  const handleCompleteExam = async () => {
    if (!window.confirm("Are you sure you want to end and submit the exam?")) return;
    await triggerAutosave();
    try {
      await sessionsApi.complete();
      toast.success("Exam submitted successfully!");
      router.push("/student/exams");
    } catch { toast.error("Failed to submit exam."); }
  };

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!exam || !question) return null;

  const langs = question.allowed_languages || exam.allowed_languages;
  const isDanger = secondsLeft < 300;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-[#1e2d47] bg-[#0a0e1a]/95 backdrop-blur flex items-center px-4 gap-4 sticky top-0 z-50">
        {/* Exam title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Code2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-200 truncate">{exam.title}</span>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border font-mono text-sm font-bold
          ${isDanger
            ? "border-red-500/50 bg-red-900/20 text-red-400 timer-danger"
            : "border-[#1e2d47] bg-[#0f1629] text-slate-200"
          }`}>
          <Clock className="w-3.5 h-3.5" />
          {formatTime(secondsLeft)}
        </div>

        {/* Save status */}
        <div className="text-xs text-slate-600 flex items-center gap-1.5">
          {saveStatus === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
          {saveStatus === "saved" && <><CheckCircle className="w-3 h-3 text-emerald-600" /> Saved</>}
          {saveStatus === "unsaved" && <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Unsaved</>}
        </div>

        {/* End exam */}
        <button
          onClick={handleCompleteExam}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 border border-[#1e2d47] hover:border-red-500/50 px-3 py-1.5 rounded-lg transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> End Exam
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Question Nav Sidebar ──────────────────────────────────────────── */}
        <aside className="w-14 border-r border-[#1e2d47] bg-[#0f1629] flex flex-col items-center py-4 gap-2">
          {exam.questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => handleQuestionChange(i)}
              className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all
                ${i === currentQ
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-500 hover:bg-[#1a2540] hover:text-slate-300"
                }`}
            >
              {q.order}
            </button>
          ))}
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Question Panel */}
          <div className="w-[42%] border-r border-[#1e2d47] overflow-y-auto p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 bg-[#0f1629] px-2 py-0.5 rounded-md border border-[#1e2d47]">
                  Q{question.order} · {question.marks} marks
                </span>
                <span className="text-xs text-slate-600">
                  {question.time_limit_ms}ms · {question.memory_limit_mb}MB
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100">{question.title}</h2>
            </div>

            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {question.statement}
              </div>
              {question.input_format && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Input Format</h4>
                  <p className="text-slate-400 text-sm">{question.input_format}</p>
                </div>
              )}
              {question.output_format && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Output Format</h4>
                  <p className="text-slate-400 text-sm">{question.output_format}</p>
                </div>
              )}
              {question.constraints && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Constraints</h4>
                  <p className="text-slate-400 text-sm font-mono">{question.constraints}</p>
                </div>
              )}
            </div>

            {/* Sample I/O */}
            {(question.sample_input || question.sample_output) && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sample</h4>
                <div className="grid grid-cols-2 gap-3">
                  {question.sample_input && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Input</p>
                      <pre className="bg-[#0f1629] border border-[#1e2d47] rounded-lg p-3 text-xs text-slate-300 font-mono overflow-auto">
                        {question.sample_input}
                      </pre>
                    </div>
                  )}
                  {question.sample_output && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Output</p>
                      <pre className="bg-[#0f1629] border border-[#1e2d47] rounded-lg p-3 text-xs text-slate-300 font-mono overflow-auto">
                        {question.sample_output}
                      </pre>
                    </div>
                  )}
                </div>
                {question.sample_explanation && (
                  <p className="text-xs text-slate-500 italic">{question.sample_explanation}</p>
                )}
              </div>
            )}

            {/* Question nav */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleQuestionChange(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="flex-1" />
              <button
                onClick={() => handleQuestionChange(Math.min(exam.questions.length - 1, currentQ + 1))}
                disabled={currentQ === exam.questions.length - 1}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editor + Output Panel */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Editor toolbar */}
            <div className="h-11 border-b border-[#1e2d47] bg-[#0f1629] flex items-center px-4 gap-3">
              <select
                value={language}
                onChange={e => handleLanguageChange(e.target.value)}
                className="text-xs bg-[#141c2e] border border-[#1e2d47] text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
              >
                {langs.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
              <span className="flex-1" />
              <button
                onClick={() => triggerAutosave()}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={handleRun}
                disabled={runLoading}
                className="flex items-center gap-1.5 text-xs bg-[#141c2e] hover:bg-[#1a2540] border border-[#1e2d47] hover:border-emerald-500/50 text-emerald-400 px-3 py-1.5 rounded-lg transition-all font-medium disabled:opacity-50"
              >
                {runLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitLoading}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-all font-medium disabled:opacity-50 shadow-lg shadow-blue-900/30"
              >
                {submitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit
              </button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={LANG_MAP[language] || "python"}
                value={currentCode}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  tabSize: 4,
                }}
              />
            </div>

            {/* Input / Output Panel */}
            <div className="h-52 border-t border-[#1e2d47] flex flex-col">
              <div className="flex items-center gap-1 border-b border-[#1e2d47] bg-[#0f1629] px-4">
                <button
                  onClick={() => setOutputTab("output")}
                  className={`text-xs px-3 py-2.5 border-b-2 transition-colors ${outputTab === "output"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 inline mr-1" />Custom Input / Output
                </button>
                <button
                  onClick={() => setOutputTab("verdict")}
                  className={`text-xs px-3 py-2.5 border-b-2 transition-colors ${outputTab === "verdict"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />Submit Verdict
                </button>
              </div>

              <div className="flex-1 flex min-h-0 overflow-hidden">
                {outputTab === "output" ? (
                  <>
                    <div className="w-1/2 border-r border-[#1e2d47] flex flex-col">
                      <p className="text-xs text-slate-600 px-3 py-1.5 border-b border-[#1e2d47]">stdin</p>
                      <textarea
                        value={stdin}
                        onChange={e => setStdin(e.target.value)}
                        placeholder="Enter custom input..."
                        className="flex-1 bg-transparent text-xs text-slate-300 font-mono p-3 resize-none focus:outline-none placeholder-slate-700"
                      />
                    </div>
                    <div className="w-1/2 flex flex-col overflow-auto">
                      <p className="text-xs text-slate-600 px-3 py-1.5 border-b border-[#1e2d47] shrink-0">stdout</p>
                      {runLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        </div>
                      ) : runOutput ? (
                        <div className="p-3 space-y-2 overflow-auto">
                          <div className="flex items-center gap-2 mb-2">
                            <VerdictBadge verdict={runOutput.verdict} />
                            {runOutput.time_ms && <span className="text-xs text-slate-600">{runOutput.time_ms}ms</span>}
                          </div>
                          {runOutput.compiler_output && (
                            <pre className="text-xs text-yellow-400 font-mono whitespace-pre-wrap">{runOutput.compiler_output}</pre>
                          )}
                          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{runOutput.stdout || runOutput.stderr || "(no output)"}</pre>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-700 p-3">Click Run to see output here.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 overflow-auto p-4">
                    {submitLoading ? (
                      <div className="flex items-center gap-2 text-sm text-blue-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Judging your submission...
                      </div>
                    ) : submitResult ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <VerdictBadge verdict={submitResult.verdict} />
                          {submitResult.score !== null && (
                            <span className="text-sm font-semibold text-slate-300">
                              {submitResult.score}/{question?.marks} pts
                            </span>
                          )}
                          {submitResult.passed_test_cases !== null && (
                            <span className="text-xs text-slate-500">
                              {submitResult.passed_test_cases}/{submitResult.total_test_cases} tests passed
                            </span>
                          )}
                        </div>
                        {submitResult.compiler_output && (
                          <pre className="text-xs text-yellow-400 font-mono bg-[#0f1629] p-3 rounded-lg border border-[#1e2d47] whitespace-pre-wrap overflow-auto max-h-24">
                            {submitResult.compiler_output}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700">Click Submit to grade your solution.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
