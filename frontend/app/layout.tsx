import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ExamPortal — Online Coding Examination Platform",
  description: "Secure, proctored online coding examinations for colleges and institutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0a0e1a]`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#141c2e",
              color: "#e2e8f0",
              border: "1px solid #1e2d47",
              borderRadius: "8px",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#0a0e1a" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0a0e1a" } },
          }}
        />
      </body>
    </html>
  );
}
