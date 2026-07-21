import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Sidebar } from "@/components/layout/sidebar";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme-script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Frido — Operations Control Tower",
  description: "Purchase Order priority dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen bg-frido-bg font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <Sidebar />
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-10">
          <div className="mx-auto max-w-[1600px] animate-fade-in-up">{children}</div>
        </main>
      </body>
    </html>
  );
}
