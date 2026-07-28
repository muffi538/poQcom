import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Frido — Operations Control Tower",
  description: "Purchase Order priority dashboard",
};

// The Sidebar (and the auth/permission context it needs) moved to
// (app)/layout.tsx — /login has no Sidebar at all, so this root layout
// stays a plain html/body shell shared by both.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-frido-bg font-sans text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
