"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (user.role === "admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/student/exams");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
