"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AVATAR } from "@/lib/members";

type ScoreEntry = { name: string; score: number };

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "โหลดไม่สำเร็จ");
      const sorted = [...(data.scores as ScoreEntry[])].sort(
        (a, b) => b.score - a.score
      );
      setScores(sorted);
      setDemo(Boolean(data.demo));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // โหลดครั้งแรก + poll ทุก 5 วิ
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchScores();
    const t = setInterval(fetchScores, 5000);
    return () => clearInterval(t);
  }, [fetchScores]);

  const top = scores.length > 0 ? scores[0].score : 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-sub">
              BOYS WONDER • CONDUCT PROTOCOL
            </span>
            <span className="rounded bg-mint/10 px-2 py-0.5 text-[11px] font-semibold text-mint">
              LIVE
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            🏆 Leaderboard
          </h1>
          <p className="mt-1 text-sm text-sub">
            อัปเดตอัตโนมัติทุก 5 วินาที • ติดลบได้
          </p>
        </div>
        <Link
          href="/vote"
          className="shrink-0 rounded-lg bg-mint px-5 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110"
        >
          ไปโหวต →
        </Link>
      </div>

      {demo && (
        <div className="mt-4 rounded-xl border border-mint/40 bg-mint/10 px-4 py-3 text-sm text-mint">
          โหมด demo — ยังไม่ได้ต่อ Apps Script ตั้งค่า Env แล้วจะเห็นคะแนนจริง
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-softred/40 bg-softred/10 px-4 py-3 text-sm text-softred">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-sm text-faint">กำลังโหลด…</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {scores.map((s, i) => {
            const pct =
              top > 0 ? Math.max(4, (s.score / top) * 100) : 4;
            const neg = s.score < 0;
            return (
              <li
                key={s.name}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  i === 0
                    ? "border-mint/50 bg-mint/5"
                    : "border-white/10 bg-low hover:bg-panel"
                }`}
              >
                <span className="w-10 shrink-0 text-center text-2xl">
                  {MEDALS[i] ?? `${i + 1}.`}
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-highest font-display text-lg font-bold">
                  {AVATAR[s.name] ?? s.name.charAt(0)}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-bold">{s.name}</span>
                    <span
                      className={`font-mono text-xl font-semibold ${
                        neg ? "text-softred" : "text-mint"
                      }`}
                    >
                      {s.score}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        neg ? "bg-softred" : "bg-mint"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="mt-8 border-t border-white/10 py-4 text-center text-xs text-faint">
        BOYS WONDER REPUTATION PROTOCOL • กด +1 / -1 ได้ไม่จำกัด • ติดลบได้ •
        ไม่มีรีเซ็ต
      </footer>
    </main>
  );
}
