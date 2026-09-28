"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { examsApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, Code2, Plus, Trash2, Save, FileText, Check, Shield
} from "lucide-react";

interface LocalTestCase {
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  order: number;
}

const AVAILABLE_LANGUAGES = [
  { id: "python", label: "Python 3" },
  { id: "javascript", label: "JavaScript" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
];

export default function NewQuestionPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const resolvedParams = use(params);
  const examId = parseInt(resolvedParams.examId);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Question fields
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState(1);
  const [marks, setMarks] = useState(20);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [statement, setStatement] = useState("");
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [constraints, setConstraints] = useState("");
  const [notes, setNotes] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [sampleExplanation, setSampleExplanation] = useState("");
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>([
    "python",
    "javascript",
    "cpp",
  ]);

  // Dynamic test cases list
  const [testCases, setTestCases] = useState<LocalTestCase[]>([
    {
      input_data: "",
      expected_output: "",
      is_hidden: false,
      order: 1,
    },
    {
      input_data: "",
      expected_output: "",
      is_hidden: true,
      order: 2,
    },
  ]);

  const toggleLanguage = (langId: string) => {
    setAllowedLanguages((prev) =>
      prev.includes(langId)
        ? prev.filter((id) => id !== langId)
        : [...prev, langId]
    );
  };

  const addTestCase = (hidden: boolean) => {
    setTestCases((prev) => [
      ...prev,
      {
        input_data: "",
        expected_output: "",
        is_hidden: hidden,
        order: prev.length + 1,
      },
    ]);
  };

  const removeTestCase = (index: number) => {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTestCase = (index: number, field: keyof LocalTestCase, val: any) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === index ? { ...tc, [field]: val } : tc))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a question title");
      return;
    }
    if (!statement.trim()) {
      toast.error("Please enter the problem statement");
      return;
    }

    try {
      setSubmitting(true);
      const questionPayload = {
        title: title.trim(),
        order,
        marks,
        time_limit_ms: timeLimitMs,
        memory_limit_mb: memoryLimitMb,
        statement: statement.trim(),
        input_format: inputFormat.trim(),
        output_format: outputFormat.trim(),
        constraints: constraints.trim(),
        notes: notes.trim(),
        sample_input: sampleInput,
        sample_output: sampleOutput,
        sample_explanation: sampleExplanation.trim(),
        allowed_languages: allowedLanguages,
      };

      const res = await examsApi.createQuestion(examId, questionPayload);
      const createdQuestion = res.data.data || res.data;
      const qId = createdQuestion.id;

      // Also create test cases if any have content
      const validTestCases = testCases.filter(
        (tc) => tc.input_data.trim() || tc.expected_output.trim()
      );

      for (let i = 0; i < validTestCases.length; i++) {
        const tc = validTestCases[i];
        await examsApi.createTestCase(examId, qId, {
          input_data: tc.input_data,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden,
          order: i + 1,
          time_limit_ms: timeLimitMs,
          memory_limit_mb: memoryLimitMb,
        });
      }

      toast.success("Question and test cases created successfully!");
      router.push(`/admin/exams/${examId}`);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.errors?.detail ||
        (typeof err.response?.data?.errors === "object"
          ? JSON.stringify(err.response.data.errors)
          : "Failed to create question");
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link
        href={`/admin/exams/${examId}`}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Exam
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Add Problem to Exam</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Configure problem statement, test cases (public and hidden), and constraints
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Settings */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" /> Basic Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Problem Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Invert a Binary Tree"
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Marks / Points
              </label>
              <input
                type="number"
                min={1}
                required
                value={marks}
                onChange={(e) => setMarks(parseInt(e.target.value) || 20)}
                className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Question Order
              </label>
              <input
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Time Limit (ms)
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(parseInt(e.target.value) || 2000)}
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Memory Limit (MB)
              </label>
              <input
                type="number"
                min={32}
                max={1024}
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(parseInt(e.target.value) || 256)}
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Problem Statement */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3">
            Problem Description
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Problem Statement <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Full description of the problem, background, and requirements..."
              className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Input Format
              </label>
              <textarea
                rows={3}
                value={inputFormat}
                onChange={(e) => setInputFormat(e.target.value)}
                placeholder="e.g. First line contains an integer T..."
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Output Format
              </label>
              <textarea
                rows={3}
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                placeholder="e.g. Print a single integer denoting the maximum sum..."
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Constraints
              </label>
              <textarea
                rows={2}
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Notes / Hints
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or hints..."
                className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Sample Case */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-[#1e2d47] pb-3">
            Sample Test Case (Visible to Candidate)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Sample Input (stdin)
              </label>
              <textarea
                rows={4}
                value={sampleInput}
                onChange={(e) => setSampleInput(e.target.value)}
                placeholder="3\n1 2 3"
                className="w-full font-mono px-3.5 py-2 bg-[#0a0e1a] border border-[#1e2d47] rounded-xl text-xs text-emerald-400 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Sample Output (stdout)
              </label>
              <textarea
                rows={4}
                value={sampleOutput}
                onChange={(e) => setSampleOutput(e.target.value)}
                placeholder="6"
                className="w-full font-mono px-3.5 py-2 bg-[#0a0e1a] border border-[#1e2d47] rounded-xl text-xs text-blue-400 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Sample Explanation
            </label>
            <input
              type="text"
              value={sampleExplanation}
              onChange={(e) => setSampleExplanation(e.target.value)}
              placeholder="e.g. 1 + 2 + 3 = 6, which is the sum of array elements."
              className="w-full px-3.5 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Dynamic Test Cases (Public & Hidden) */}
        <div className="glass rounded-2xl p-6 border border-[#1e2d47] space-y-4">
          <div className="flex items-center justify-between border-b border-[#1e2d47] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Evaluation Test Cases ({testCases.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Include both visible and hidden test cases for grading
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addTestCase(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Visible Case
              </button>
              <button
                type="button"
                onClick={() => addTestCase(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-all flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" /> Hidden Case
              </button>
            </div>
          </div>

          {testCases.map((tc, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border space-y-3 ${
                tc.is_hidden
                  ? "bg-purple-950/10 border-purple-800/30"
                  : "bg-[#0b1220] border-[#1e2d47]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Case #{index + 1}</span>
                  {tc.is_hidden ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-700/50 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Hidden Test Case
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-700/50">
                      Sample Visible Case
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tc.is_hidden}
                      onChange={(e) => updateTestCase(index, "is_hidden", e.target.checked)}
                      className="rounded border-slate-700"
                    />
                    <span>Hidden</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTestCase(index)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Input Data (stdin)</label>
                  <textarea
                    rows={3}
                    value={tc.input_data}
                    onChange={(e) => updateTestCase(index, "input_data", e.target.value)}
                    placeholder="Input lines..."
                    className="w-full font-mono text-xs px-3 py-2 bg-[#060a14] border border-[#1e2d47] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Expected Output (stdout)
                  </label>
                  <textarea
                    rows={3}
                    value={tc.expected_output}
                    onChange={(e) => updateTestCase(index, "expected_output", e.target.value)}
                    placeholder="Expected output lines..."
                    className="w-full font-mono text-xs px-3 py-2 bg-[#060a14] border border-[#1e2d47] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/admin/exams/${examId}`}
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
            {submitting ? "Saving Problem..." : "Save Problem & Test Cases"}
          </button>
        </div>
      </form>
    </div>
  );
}
