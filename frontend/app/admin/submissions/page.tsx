"use client";

import { useEffect, useState } from "react";
import { submissionsApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  BarChart3, Search, Filter, Code2, CheckCircle2,
  XCircle, Clock, AlertTriangle, Eye, X, Copy, Check
} from "lucide-react";

interface TestResult {
  id: number;
  verdict: string;
  time_ms: number;
  memory_mb: number;
  stdout: string;
  stderr: string;
  output_matched: boolean;
}

interface Submission {
  id: number;
  student_name: string;
  student_email: string;
  question: number;
  language: string;
  code: string;
  submitted_at: string;
  verdict: string;
  score: number;
  passed_test_cases: number;
  total_test_cases: number;
  compiler_output: string;
  judged_at: string;
  worker_id: string;
  test_results?: TestResult[];
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await submissionsApi.adminList({
        verdict: verdictFilter !== "all" ? verdictFilter : undefined,
      });
      const list = res.data.results || res.data || [];
      setSubmissions(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [verdictFilter]);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "accepted":
      case "AC":
        return {
          label: "Accepted",
          color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
          icon: CheckCircle2,
        };
      case "wrong_answer":
      case "WA":
        return {
          label: "Wrong Answer",
          color: "text-red-400 bg-red-950/40 border-red-800/40",
          icon: XCircle,
        };
      case "time_limit_exceeded":
      case "TLE":
        return {
          label: "Time Limit Exceeded",
          color: "text-amber-400 bg-amber-950/40 border-amber-800/40",
          icon: Clock,
        };
      case "memory_limit_exceeded":
      case "MLE":
        return {
          label: "Memory Limit Exceeded",
          color: "text-purple-400 bg-purple-950/40 border-purple-800/40",
          icon: AlertTriangle,
        };
      case "compilation_error":
      case "CE":
        return {
          label: "Compilation Error",
          color: "text-orange-400 bg-orange-950/40 border-orange-800/40",
          icon: AlertTriangle,
        };
      case "runtime_error":
      case "RE":
        return {
          label: "Runtime Error",
          color: "text-rose-400 bg-rose-950/40 border-rose-800/40",
          icon: XCircle,
        };
      case "pending":
      case "judging":
        return {
          label: "Judging...",
          color: "text-blue-400 bg-blue-950/40 border-blue-800/40 animate-pulse",
          icon: Clock,
        };
      default:
        return {
          label: verdict,
          color: "text-slate-400 bg-slate-800 border-slate-700",
          icon: AlertTriangle,
        };
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredSubmissions = submissions.filter(
    (s) =>
      s.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_email?.toLowerCase().includes(search.toLowerCase()) ||
      s.language?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Submissions Explorer</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Inspect all student code submissions, test case outcomes, and compiler outputs
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, email, or language..."
            className="w-full pl-10 pr-4 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-500 hidden sm:block shrink-0" />
          {[
            { id: "all", label: "All" },
            { id: "accepted", label: "Accepted" },
            { id: "wrong_answer", label: "WA" },
            { id: "time_limit_exceeded", label: "TLE" },
            { id: "compilation_error", label: "CE" },
            { id: "runtime_error", label: "RE" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setVerdictFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                verdictFilter === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-[#1e2d47]/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
          <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No submissions found</h3>
          <p className="text-slate-500 text-sm mt-1">
            Submitted candidate solutions and verdicts will be cataloged here.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-[#1e2d47]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1220] border-b border-[#1e2d47] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Candidate</th>
                <th className="px-5 py-3.5 font-medium">Question</th>
                <th className="px-5 py-3.5 font-medium">Language</th>
                <th className="px-5 py-3.5 font-medium">Verdict</th>
                <th className="px-5 py-3.5 font-medium">Pass Rate</th>
                <th className="px-5 py-3.5 font-medium">Score</th>
                <th className="px-5 py-3.5 font-medium">Submitted</th>
                <th className="px-5 py-3.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {filteredSubmissions.map((sub) => {
                const verdict = getVerdictBadge(sub.verdict);
                const VIcon = verdict.icon;
                const submittedDate = new Date(sub.submitted_at);

                return (
                  <tr key={sub.id} className="hover:bg-[#141c2e] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-200">{sub.student_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{sub.student_email}</p>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-slate-300">
                      Q{sub.question}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono uppercase text-[11px] px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40">
                        {sub.language}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${verdict.color}`}
                      >
                        <VIcon className="w-3 h-3" /> {verdict.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      {sub.passed_test_cases}/{sub.total_test_cases}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-slate-200">
                      {sub.score}
                    </td>

                    <td className="px-5 py-3.5 text-slate-400">
                      {submittedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedSub(sub)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Inspect Code
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Code Inspection Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-3xl border border-[#1e2d47] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  Submission #{selectedSub.id} — {selectedSub.student_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Question #{selectedSub.question} • Language: {selectedSub.language.toUpperCase()} • Score: {selectedSub.score} pts
                </p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {/* Verdict Summary */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0b1220] border border-[#1e2d47]">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Final Verdict:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      getVerdictBadge(selectedSub.verdict).color
                    }`}
                  >
                    {getVerdictBadge(selectedSub.verdict).label}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  Test Cases: {selectedSub.passed_test_cases} / {selectedSub.total_test_cases} Passed
                </div>
              </div>

              {/* Compiler Output if any */}
              {selectedSub.compiler_output && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-400 mb-1.5">Compiler Output</h4>
                  <pre className="p-3 rounded-xl bg-[#080d19] border border-[#1e2d47] text-xs font-mono text-amber-300 whitespace-pre-wrap">
                    {selectedSub.compiler_output}
                  </pre>
                </div>
              )}

              {/* Source Code Container */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-semibold text-slate-300">Submitted Source Code</h4>
                  <button
                    onClick={() => handleCopyCode(selectedSub.code)}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCode ? "Copied" : "Copy Code"}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-[#060a14] border border-[#1e2d47] text-xs font-mono text-slate-200 overflow-x-auto max-h-72">
                  {selectedSub.code}
                </pre>
              </div>

              {/* Detailed Test Results */}
              {selectedSub.test_results && selectedSub.test_results.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">Test Case Results</h4>
                  <div className="space-y-2">
                    {selectedSub.test_results.map((tr, idx) => (
                      <div
                        key={tr.id || idx}
                        className="p-3 rounded-xl bg-[#0a0f1d] border border-[#1e2d47] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-400">Test #{idx + 1}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              getVerdictBadge(tr.verdict).color
                            }`}
                          >
                            {getVerdictBadge(tr.verdict).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                          <span>{tr.time_ms} ms</span>
                          <span>{tr.memory_mb.toFixed(1)} MB</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#1e2d47] flex justify-end">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-[#131c2e] text-slate-300 border border-[#1e2d47] hover:bg-[#1a273f]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
