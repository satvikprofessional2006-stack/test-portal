"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Shield, User, Lock, Eye, EyeOff, AlertCircle,
  GraduationCap, ArrowRight, Laptop2
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const data = res.data;

      setAuth(
        {
          id: data.user_id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
        },
        data.access,
        data.refresh
      );

      toast.success(`Welcome back, ${data.full_name}!`);

      if (data.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/student/exams");
      }
    } catch (err: any) {
      const errDetail =
        err.response?.data?.errors?.detail ||
        err.response?.data?.errors?.non_field_errors?.[0] ||
        "Invalid email or password. Please try again.";
      setError(errDetail);
      toast.error(errDetail);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-background p-3 sm:p-4 lg:p-6 font-sans overflow-hidden relative">
      {/* Top right ThemeToggle */}
      <div className="absolute top-6 right-6 z-30">
        <ThemeToggle />
      </div>

      {/* ── Left panel — brand art & university identity ── */}
      <div className="relative w-full lg:w-[44%] h-56 sm:h-72 lg:h-full rounded-[28px] overflow-hidden flex flex-col justify-between p-7 sm:p-10 text-white shrink-0 select-none shadow-xl">
        {/* Background image */}
        <img
          src="/RU-BG.png"
          alt="University Campus"
          className="absolute inset-0 w-full h-full object-cover blur-[2px] brightness-[0.55] scale-[1.03]"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 z-0" />

        {/* Top: Logo + name */}
        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src="/Rishihood_University_idxo_lfgcw_2.png"
            alt="University Logo"
            className="h-10 w-10 object-contain drop-shadow-md"
          />
          <div>
            <p className="text-base font-bold tracking-tight leading-none text-white drop-shadow-md">
              Rishihood University
            </p>
            <p className="text-[11px] font-semibold text-[#FFEDD2]/90 tracking-widest uppercase mt-1">
              Examination Portal
            </p>
          </div>
        </div>

        {/* Bottom: headline & mission */}
        <div className="relative z-10 mt-auto">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
            <Shield className="h-3.5 w-3.5 text-[#FFEDD2]" />
            <span className="text-[11px] font-semibold text-white/90 tracking-wide">
              Secure Proctoring & Evaluation
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
            Test smarter,
            <br />
            not harder.
          </h2>
          <p className="text-xs sm:text-sm text-white/80 mt-3 tracking-wide max-w-sm leading-relaxed">
            Centralized coding examination platform with server-authoritative timers,
            sandboxed judges, and integrity monitoring.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="w-full lg:w-[56%] flex flex-col justify-center px-6 sm:px-10 lg:px-20 pt-8 sm:pt-10 lg:pt-0 pb-4 overflow-y-auto">
        <div className="max-w-sm mx-auto w-full space-y-7">
          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter your university portal credentials to access your examination or admin panel.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Error banner */}
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/25 p-3.5 text-xs text-destructive flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Email / Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 block">
                University Email Address
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  className="w-full pl-10 pr-4 h-11 text-sm bg-card border border-border/70 text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 h-11 text-sm bg-card border border-border/70 text-foreground placeholder:text-muted-foreground/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-sm font-semibold rounded-xl mt-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-2 border-t border-border/50 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Quick Test Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@college.edu", "Admin@12345")}
                className="p-2.5 rounded-xl border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary">
                  <Laptop2 className="h-3.5 w-3.5 text-primary" /> Admin Portal
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                  admin@college.edu
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("student1@college.edu", "Student@12345")}
                className="p-2.5 rounded-xl border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" /> Student Portal
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                  student1@college.edu
                </p>
              </button>
            </div>
          </div>

          {/* Footer hint */}
          <p className="text-[11px] text-muted-foreground/70 text-center">
            Contact your examination administrator if you need credential assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
