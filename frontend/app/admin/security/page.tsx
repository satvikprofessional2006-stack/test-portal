"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { securityApi } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle,
  Eye, RefreshCw, Filter, Search, Info, Monitor, Copy, X
} from "lucide-react";

interface SecurityEvent {
  id: number;
  session: number;
  event_type: string;
  severity: "info" | "warning" | "critical" | string;
  payload: Record<string, any>;
  timestamp: string;
  ip_address: string;
  source: string;
}

export default function AdminSecurityEventsPage() {
  const searchParams = useSearchParams();
  const sessionIdFilter = searchParams.get("session_id");

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await securityApi.adminEvents({
        session_id: sessionIdFilter ? parseInt(sessionIdFilter) : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
      });
      const list = res.data.results || res.data || [];
      setEvents(list);
    } catch (err: any) {
      toast.error(err.response?.data?.errors?.detail || "Failed to load security audit events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [sessionIdFilter, severityFilter]);

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return {
          label: "Critical",
          color: "text-red-400 bg-red-950/40 border-red-800/40",
          icon: AlertCircle,
        };
      case "warning":
        return {
          label: "Warning",
          color: "text-amber-400 bg-amber-950/40 border-amber-800/40",
          icon: AlertTriangle,
        };
      case "info":
      default:
        return {
          label: "Info",
          color: "text-blue-400 bg-blue-950/40 border-blue-800/40",
          icon: Info,
        };
    }
  };

  const getEventTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const criticalCount = events.filter((e) => e.severity === "critical").length;
  const warningCount = events.filter((e) => e.severity === "warning").length;

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.event_type.toLowerCase().includes(search.toLowerCase()) ||
      e.ip_address?.includes(search) ||
      String(e.session).includes(search);
    return matchesSearch;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">Anti-Cheat & Security Logs</h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/40 text-blue-400 border border-blue-800/40">
              <ShieldAlert className="w-3.5 h-3.5" /> Proctoring Engine
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Auditing tab switching, copy-paste attempts, fullscreen exits, and browser irregularities
          </p>
        </div>

        <button
          onClick={fetchEvents}
          className="p-2 text-slate-400 hover:text-slate-200 bg-[#131c2e] border border-[#1e2d47] rounded-xl hover:bg-[#1a273f] transition-all flex items-center gap-2 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-2xl p-5 border border-[#1e2d47]">
          <p className="text-xs text-slate-500">Total Security Events</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{events.length}</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-red-900/30 bg-red-950/10">
          <p className="text-xs text-red-400 font-medium">Critical Infractions</p>
          <p className="text-2xl font-bold text-red-300 mt-1">{criticalCount}</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-amber-900/30 bg-amber-950/10">
          <p className="text-xs text-amber-400 font-medium">Warnings Logged</p>
          <p className="text-2xl font-bold text-amber-300 mt-1">{warningCount}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event type, IP, or session..."
            className="w-full pl-10 pr-4 py-2 bg-[#0c1322] border border-[#1e2d47] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-500 hidden sm:block shrink-0" />
          {[
            { id: "all", label: "All Severities" },
            { id: "critical", label: "Critical" },
            { id: "warning", label: "Warnings" },
            { id: "info", label: "Info" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeverityFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                severityFilter === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-[#1e2d47]/60"
              }`}
            >
              {item.label}
            </button>
          ))}
          {sessionIdFilter && (
            <Link
              href="/admin/security"
              className="text-xs text-blue-400 hover:text-blue-300 ml-2"
            >
              Reset Session Filter
            </Link>
          )}
        </div>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-[#1e2d47]">
          <ShieldCheck className="w-12 h-12 text-emerald-500/80 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No security events found</h3>
          <p className="text-slate-500 text-sm mt-1">
            Browser security infractions, focus losses, and copy-paste incidents will be displayed here.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-[#1e2d47]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1220] border-b border-[#1e2d47] text-slate-400">
              <tr>
                <th className="px-5 py-3.5 font-medium">Timestamp</th>
                <th className="px-5 py-3.5 font-medium">Session ID</th>
                <th className="px-5 py-3.5 font-medium">Event Type</th>
                <th className="px-5 py-3.5 font-medium">Severity</th>
                <th className="px-5 py-3.5 font-medium">Source & IP</th>
                <th className="px-5 py-3.5 font-medium text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {filteredEvents.map((event) => {
                const sev = getSeverityBadge(event.severity);
                const SIcon = sev.icon;
                const date = new Date(event.timestamp);

                return (
                  <tr key={event.id} className="hover:bg-[#141c2e] transition-colors">
                    <td className="px-5 py-3.5 text-slate-300 font-mono">
                      {date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400">
                      <Link
                        href={`/admin/sessions?session_id=${event.session}`}
                        className="hover:text-blue-400 underline"
                      >
                        #{event.session}
                      </Link>
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-slate-200">
                      {getEventTypeLabel(event.event_type)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${sev.color}`}
                      >
                        <SIcon className="w-3 h-3" /> {sev.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-400 font-mono">
                      <span>{event.ip_address || "127.0.0.1"}</span>{" "}
                      <span className="text-[10px] text-slate-600">({event.source})</span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#131c2e] text-slate-300 border border-[#1e2d47] hover:border-slate-500 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Event Payload Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-lg border border-[#1e2d47] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Security Event #{selectedEvent.id}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getEventTypeLabel(selectedEvent.event_type)} • Session #{selectedEvent.session}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#0b1220] p-3.5 rounded-xl border border-[#1e2d47]">
                <div>
                  <p className="text-slate-500">Timestamp</p>
                  <p className="text-slate-200 font-mono mt-0.5">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">IP Address</p>
                  <p className="text-slate-200 font-mono mt-0.5">
                    {selectedEvent.ip_address || "127.0.0.1"}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Event Payload Data</h4>
                <pre className="p-4 rounded-xl bg-[#060a14] border border-[#1e2d47] text-xs font-mono text-emerald-400 overflow-x-auto max-h-60 whitespace-pre-wrap">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#1e2d47] flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
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
