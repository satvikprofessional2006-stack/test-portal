"use client";

import { useEffect, useState, useRef } from "react";
import { usersApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Users, UserPlus, Upload, Search, Download, Check, AlertCircle, FileSpreadsheet, X
} from "lucide-react";

interface Student {
  id: number;
  email: string;
  full_name: string;
  role: string;
  roll_number?: string;
  institution?: string;
  department?: string;
  date_joined?: string;
  is_active: boolean;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add Single Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    full_name: "",
    password: "",
    roll_number: "",
    institution: "",
    department: "",
    role: "student",
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Bulk CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await usersApi.list({ role: "student", search: search.trim() || undefined });
      const list = res.data.results || res.data || [];
      setStudents(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load students roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email || !addForm.full_name || !addForm.password) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      setSubmittingAdd(true);
      await usersApi.create(addForm);
      toast.success("Student account created successfully!");
      setShowAddModal(false);
      setAddForm({
        email: "",
        full_name: "",
        password: "",
        roll_number: "",
        institution: "",
        department: "",
        role: "student",
      });
      fetchStudents();
    } catch (err: any) {
      const errDetail =
        err.response?.data?.errors?.email?.[0] ||
        err.response?.data?.errors?.detail ||
        "Failed to create student";
      toast.error(errDetail);
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a CSV file first");
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);
      const res = await usersApi.importCSV(selectedFile);
      const result = res.data.data || res.data;
      setImportResult(result);
      toast.success(`Import complete! ${result.created} students created.`);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.file || "Failed to import CSV");
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,email,full_name,password,roll_number,institution,department\n" +
      "john.doe@college.edu,John Doe,Pass@1234,CS2026-001,Engineering Institute,Computer Science\n" +
      "jane.smith@college.edu,Jane Smith,Pass@1234,CS2026-002,Engineering Institute,Information Tech\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "students_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Students Directory</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage student registrations, rolls, and bulk cohort uploads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
              setSelectedFile(null);
            }}
            className="flex items-center gap-2 bg-[#131c2e] hover:bg-[#1a273f] text-slate-300 text-xs font-medium px-4 py-2.5 rounded-xl border border-[#1e2d47] transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" /> Bulk CSV Import
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, roll number, or email..."
            className="w-full pl-10 pr-4 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          Total Candidates: <span className="font-semibold text-slate-200">{students.length}</span>
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl skeleton" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No students registered</h3>
          <p className="text-slate-500 text-sm mt-1">
            Add individual student accounts or upload a CSV file with your student cohort.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Student
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-[#131c2e] text-slate-300 border border-[#1e2d47] hover:bg-[#1a273f] transition-all"
            >
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-[#1e2d47]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1220] border-b border-[#1e2d47] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Candidate Name</th>
                <th className="px-5 py-3.5 font-medium">Roll Number</th>
                <th className="px-5 py-3.5 font-medium">Email</th>
                <th className="px-5 py-3.5 font-medium">Institution & Dept</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-[#141c2e] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-400 shrink-0">
                        {student.full_name[0]?.toUpperCase() || "S"}
                      </div>
                      <span className="font-semibold text-slate-200">{student.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-300">
                    {student.roll_number || "—"}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-400">{student.email}</td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {student.institution ? (
                      <div>
                        <p className="text-slate-300 font-medium">{student.institution}</p>
                        <p className="text-[11px] text-slate-500">{student.department || "General"}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Single Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-lg border border-[#1e2d47] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" /> Add Student Candidate
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="student@college.edu"
                    className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Initial Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="Temporary login password"
                    className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Roll / Registration Number
                </label>
                <input
                  type="text"
                  value={addForm.roll_number}
                  onChange={(e) => setAddForm({ ...addForm, roll_number: e.target.value })}
                  placeholder="e.g. CS2026-042"
                  className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Institution / College
                  </label>
                  <input
                    type="text"
                    value={addForm.institution}
                    onChange={(e) => setAddForm({ ...addForm, institution: e.target.value })}
                    placeholder="e.g. IIT Bombay"
                    className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3.5 py-2.5 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#1e2d47]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-900/30"
                >
                  {submittingAdd ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-lg border border-[#1e2d47] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Bulk Student Import (CSV)
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCSVImport} className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload a CSV spreadsheet with candidate information. Required headers:{" "}
                <code className="text-blue-400 font-mono">email</code>,{" "}
                <code className="text-blue-400 font-mono">full_name</code>,{" "}
                <code className="text-blue-400 font-mono">password</code>. Optional:{" "}
                <code className="text-slate-400 font-mono">roll_number</code>,{" "}
                <code className="text-slate-400 font-mono">institution</code>,{" "}
                <code className="text-slate-400 font-mono">department</code>.
              </p>

              <button
                type="button"
                onClick={downloadSampleCSV}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download Sample CSV Template
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#1e2d47] hover:border-blue-500/50 rounded-2xl p-6 text-center cursor-pointer bg-[#0c1322]/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-300">
                  {selectedFile ? selectedFile.name : "Click to select CSV file"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">.csv files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              {importResult && (
                <div className="bg-[#0b1220] p-4 rounded-xl border border-[#1e2d47] text-xs space-y-1">
                  <p className="text-emerald-400 font-medium">
                    ✓ {importResult.created} students created
                  </p>
                  {importResult.skipped > 0 && (
                    <p className="text-amber-400">
                      ⚠ {importResult.skipped} existing emails skipped
                    </p>
                  )}
                  {importResult.errors?.length > 0 && (
                    <p className="text-red-400">
                      ✕ {importResult.errors.length} rows encountered errors
                    </p>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1e2d47]">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || importing}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-900/30"
                >
                  {importing ? "Importing..." : "Start Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
