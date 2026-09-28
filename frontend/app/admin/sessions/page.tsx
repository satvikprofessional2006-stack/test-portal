"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { sessionsApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Activity, Clock, ShieldAlert, RefreshCw, AlertTriangle,
  StopCircle, CheckCircle, Wifi, WifiOff, Search, PlusCircle, RotateCcw
} from "lucide-react";

interface ActiveSession {
  session_id: number;
  student_name: string;
  student_email: string;
  exam_title: string;
  exam_id: number;
  started_at: string;
  seconds_remaining: number;
  ip_address: string;
  last_heartbeat_at: string;
}

export default function AdminLiveSessionsPage() {
  const searchParams = useSearchParams();
  const examIdFilter = searchParams.get("exam_id");

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [terminatingId, setTerminatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveSessions = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await sessionsApi.activeSessions();
      let list: ActiveSession[] = res.data.data || res.data || [];
      if (examIdFilter) {
        list = list.filter((s) => s.exam_id === parseInt(examIdFilter));
      }
      setSessions(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load live sessions");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions(true);

    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchActiveSessions(false);
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, examIdFilter]);

  const handleTerminate = async (sessionId: number, studentName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to forcibly terminate ${studentName}'s exam session? This action is immediate and will log a security flag.`
      )
    ) {
      return;
    }

    try {
      setTerminatingId(sessionId);
      await sessionsApi.terminate(sessionId);
      toast.success(`Session for ${studentName} terminated.`);
      fetchActiveSessions(false);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to terminate session");
    } finally {
      setTerminatingId(null);
    }
  };

  const handleExtend = async (sessionId: number, studentName: string) => {
    try {
      await sessionsApi.extend(sessionId, 15);
      toast.success(`Added 15 minutes to ${studentName}'s session.`);
      fetchActiveSessions(false);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to extend session");
    }
  };

  const handleReset = async (sessionId: number, studentName: string) => {
    if (!window.confirm(`Reset exam session for ${studentName}? This allows them to enter and start the exam afresh.`)) {
      return;
    }
    try {
      await sessionsApi.reset(sessionId);
      toast.success(`Exam session reset for ${studentName}. Candidate can enter afresh.`);
      fetchActiveSessions(false);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to reset session");
    }
  };

  const getHeartbeatStatus = (lastHeartbeatStr: string) => {
    const diffSec = Math.floor(
      (new Date().getTime() - new Date(lastHeartbeatStr).getTime()) / 1000
    );
    if (diffSec < 45) {
      return {
        label: "Active",
        color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
        icon: Wifi,
      };
    }
    if (diffSec < 120) {
      return {
        label: "Lagging",
        color: "text-amber-400 bg-amber-950/40 border-amber-800/40",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Offline",
      color: "text-red-400 bg-red-950/40 border-red-800/40",
      icon: WifiOff,
    };
  };

  const formatRemaining = (seconds: number) => {
    if (seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) {
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${String(remMins).padStart(2, "0")}m`;
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.student_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_email.toLowerCase().includes(search.toLowerCase()) ||
      s.exam_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">Live Exam Sessions</h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Real-time proctoring: monitor active students, heartbeats, and time remaining
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
              autoRefresh
                ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                : "bg-[#131c2e] text-slate-400 border-[#1e2d47]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto-refreshing (5s)" : "Paused"}
          </button>
          <button
            onClick={() => fetchActiveSessions(true)}
            className="p-2 text-slate-400 hover:text-slate-200 bg-[#131c2e] border border-[#1e2d47] rounded-xl hover:bg-[#1a273f] transition-all"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student or exam..."
            className="w-full pl-10 pr-4 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            Active Candidates:{" "}
            <span className="font-bold text-emerald-400">{sessions.length}</span>
          </span>
          {examIdFilter && (
            <Link
              href="/admin/sessions"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Clear Exam Filter
            </Link>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
          <Activity className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No active exam sessions</h3>
          <p className="text-slate-500 text-sm mt-1">
            When candidates start taking an exam, their live progress and heartbeats appear here in real time.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-[#1e2d47]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1220] border-b border-[#1e2d47] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Candidate</th>
                <th className="px-5 py-3.5 font-medium">Exam Paper</th>
                <th className="px-5 py-3.5 font-medium">Time Left</th>
                <th className="px-5 py-3.5 font-medium">Status & Heartbeat</th>
                <th className="px-5 py-3.5 font-medium">IP Address</th>
                <th className="px-5 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {filteredSessions.map((session) => {
                const hb = getHeartbeatStatus(session.last_heartbeat_at);
                const HbIcon = hb.icon;

                return (
                  <tr key={session.session_id} className="hover:bg-[#141c2e] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-400 shrink-0">
                          {session.student_name[0]?.toUpperCase() || "S"}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">{session.student_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {session.student_email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-300">{session.exam_title}</span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`font-mono font-bold text-xs ${
                          session.seconds_remaining < 300
                            ? "text-red-400 animate-pulse"
                            : "text-slate-200"
                        }`}
                      >
                        {formatRemaining(session.seconds_remaining)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${hb.color}`}
                      >
                        <HbIcon className="w-3 h-3" /> {hb.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      {session.ip_address || "127.0.0.1"}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleExtend(session.session_id, session.student_name)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/50 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Add 15 minutes to session"
                        >
                          <PlusCircle className="w-3 h-3" /> +15m
                        </button>
                        <button
                          onClick={() => handleReset(session.session_id, session.student_name)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-950/40 text-blue-400 border border-blue-800/40 hover:bg-blue-900/50 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Reset student session to allow re-entry"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                        <Link
                          href={`/admin/security?session_id=${session.session_id}`}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-[#131c2e] text-slate-300 border border-[#1e2d47] hover:border-slate-500 transition-colors flex items-center gap-1"
                          title="View security events"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-400" /> Logs
                        </Link>
                        <button
                          onClick={() =>
                            handleTerminate(session.session_id, session.student_name)
                          }
                          disabled={terminatingId === session.session_id}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-red-950/40 text-red-400 border border-red-800/40 hover:bg-red-900/50 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          <StopCircle className="w-3 h-3" /> Terminate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
