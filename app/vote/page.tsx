"use client";

import { useCallback, useEffect, useState } from "react";

type ScoreEntry = { name: string; score: number };

export default function VotePage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "โหลดไม่สำเร็จ");
      setScores(data.scores);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // โหลดคะแนนครั้งแรกจาก external API
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchScores();
  }, [fetchScores]);

  async function vote(name: string, delta: 1 | -1) {
    if (busy) return;
    setBusy(`${name}:${delta}`);
    // optimistic update
    setScores((prev) =>
      prev.map((s) => (s.name === name ? { ...s, score: s.score + delta } : s))
    );
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "โหวตไม่สำเร็จ");
      setScores(data.scores);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหวตไม่สำเร็จ");
      fetchScores(); // rollback ด้วยค่าจริง
    } finally {
      // กันกดเบิ้ล 0.8 วิ (ลด race บน Sheet)
      setTimeout(() => setBusy(null), 800);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">🗳️ โหวตความประพฤติ</h1>
      <p className="mt-1 text-sm text-zinc-400">
        ใครก็กดได้ กดได้เรื่อยๆ ไม่จำกัด • +1 ถ้าทำดี / -1 ถ้าเกรียน • ติดลบได้
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-zinc-400">กำลังโหลด…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scores.map((s) => (
            <div
              key={s.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{s.name}</span>
                <span
                  className={`font-mono text-2xl font-extrabold ${
                    s.score < 0 ? "text-red-400" : "text-emerald-300"
                  }`}
                >
                  {s.score}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => vote(s.name, -1)}
                  className="rounded-xl bg-red-500/90 px-4 py-2.5 font-bold hover:bg-red-500 disabled:opacity-40"
                >
                  −1 เกรียน
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => vote(s.name, 1)}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 font-bold text-black hover:bg-emerald-400 disabled:opacity-40"
                >
                  +1 ทำดี
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
