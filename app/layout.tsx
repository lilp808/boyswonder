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
    <html lang="th" className="dark">
      <body className="min-h-screen bg-base text-ink antialiased">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-base/85 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-high">
                <span className="material-symbols-outlined text-[20px]">
                  how_to_vote
                </span>
              </span>
              BOYS WONDER
              <span className="hidden text-xs font-medium text-faint sm:inline">
                CONDUCT PROTOCOL
              </span>
            </Link>
            <div className="flex gap-2">
              <Link
                href="/"
                className="rounded-lg bg-high px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-highest"
              >
                🏆 Leaderboard
              </Link>
              <Link
                href="/vote"
                className="rounded-lg bg-mint px-4 py-2 text-sm font-bold text-black transition-colors hover:brightness-110"
              >
                🗳️ โหวต
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
