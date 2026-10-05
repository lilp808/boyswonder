import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Trophy, Vote } from "lucide-react";
import { DEFAULT_SETTINGS } from "@/lib/members";
import { getSettings, isSheetsConfigured } from "@/lib/sheets";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boys Wonder — คะแนนความประพฤติ",
  description: "Leaderboard + โหวตความประพฤติแก๊ง Boys Wonder",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let siteName = DEFAULT_SETTINGS.site_name;
  let tagline = DEFAULT_SETTINGS.site_tagline;
  if (isSheetsConfigured()) {
    try {
      const s = await getSettings();
      siteName = s.site_name;
      tagline = s.site_tagline;
    } catch {
      // fallback ค่า default
    }
  }
  return (
    <html lang="th" className="dark">
      <body className="min-h-screen bg-base text-ink antialiased">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-base/85 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-high">
                <Vote size={20} />
              </span>
              {siteName}
              <span className="hidden text-xs font-medium text-faint sm:inline">
                {tagline}
              </span>
            </Link>
            <div className="flex gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-lg bg-high px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-highest"
              >
                <Trophy size={16} />
                Leaderboard
              </Link>
              <Link
                href="/vote"
                className="flex items-center gap-1.5 rounded-lg bg-mint px-4 py-2 text-sm font-bold text-black transition-colors hover:brightness-110"
              >
                <Vote size={16} />
                โหวต
              </Link>
              <Link
                href="/edit"
                title="แก้ไขข้อมูลเว็บ"
                className="flex items-center gap-1.5 rounded-lg bg-high px-3 py-2 text-sm font-semibold text-faint transition-colors hover:bg-highest hover:text-ink"
              >
                <Pencil size={16} />
                <span className="hidden sm:inline">edit</span>
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
