"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Eye, EyeOff, Lock, Mail, Code2, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { access, refresh, role, full_name, user_id } = res.data;
      setAuth({ id: user_id, email: email.trim().toLowerCase(), full_name, role }, access, refresh);
      toast.success(`Welcome back, ${full_name}!`);
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/student/exams");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.errors?.detail
        || err?.response?.data?.detail
        || "Invalid credentials. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <Code2 className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">ExamPortal</h1>
          <p className="text-slate-400 mt-2 text-sm">Secure Online Coding Examinations</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Secure Sign In
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@institution.edu"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0f1629] border border-[#1e2d47] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-[#0f1629] border border-[#1e2d47] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-6">
            Contact your administrator if you need access.
          </p>
        </div>

        {/* Role hint */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 glass rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500">Student</p>
            <p className="text-xs text-slate-400 mt-0.5">→ Exam Portal</p>
          </div>
          <div className="flex-1 glass rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500">Admin</p>
            <p className="text-xs text-slate-400 mt-0.5">→ Control Panel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
