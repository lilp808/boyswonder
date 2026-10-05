import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boys Wonder — คะแนนความประพฤติ",
  description: "Leaderboard + โหวตความประพฤติแก๊ง Boys Wonder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-bold text-lg tracking-tight">
              ⭐ Boys Wonder
              <span className="ml-2 text-sm font-normal text-zinc-400">
                คะแนนความประพฤติ
              </span>
            </Link>
            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-full px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20"
              >
                🏆 Leaderboard
              </Link>
              <Link
                href="/vote"
                className="rounded-full px-4 py-2 text-sm font-medium bg-amber-400 text-black hover:bg-amber-300"
              >
                🗳️ โหวต
              </Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-white/10 py-4 text-center text-xs text-zinc-500">
          Boys Wonder • กด +1 / -1 ได้ไม่จำกัด • ติดลบได้ • ไม่มีรีเซ็ต
        </footer>
      </body>
    </html>
  );
}
