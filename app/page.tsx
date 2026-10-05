"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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
      if (!res.ok) throw new Error(data.error ?? "โหลดไม่สำเร็จ");
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
    // โหลดครั้งแรก + poll ทุก 5 วิ — เป็นการซิงค์กับ external system (API) จึงต้อง setState ใน effect
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
          <h1 className="text-3xl font-extrabold tracking-tight">
            🏆 Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            อัปเดตอัตโนมัติทุก 5 วินาที • ติดลบได้
          </p>
        </div>
        <Link
          href="/vote"
          className="shrink-0 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-300"
        >
          ไปโหวต →
        </Link>
      </div>

      {demo && (
        <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          โหมด demo — ยังไม่ได้ต่อ Google Sheet ตั้งค่า Env บน Vercel แล้วจะเห็นคะแนนจริง
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-zinc-400">กำลังโหลด…</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {scores.map((s, i) => {
            const pct = top > 0 ? Math.max(4, (s.score / top) * 100) : s.score < 0 ? 4 : 4;
            return (
              <li
                key={s.name}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${
                  i === 0
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span className="w-10 text-center text-2xl">
                  {MEDALS[i] ?? `${i + 1}.`}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold">{s.name}</span>
                    <span
                      className={`font-mono text-xl font-extrabold ${
                        s.score < 0 ? "text-red-400" : "text-emerald-300"
                      }`}
                    >
                      {s.score}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        s.score < 0 ? "bg-red-500" : "bg-emerald-400"
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
    </main>
  );
}
