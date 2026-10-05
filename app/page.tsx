"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Flame, Medal, Sparkles, Swords, Trophy } from "lucide-react";
import {
  AVATAR,
  DEFAULT_SETTINGS,
  SUBTITLE,
  type SiteSettings,
} from "@/lib/members";

type Member = {
  name: string;
  subtitle: string;
  avatar_url: string;
  bg_url: string;
  roles: { name: string; color: string }[];
  sort_order: number;
  is_active: boolean;
  score: number;
};
type FeedEntry = { t: string; name: string; delta: number; reason?: string };

function RoleChips({ roles }: { roles: Member["roles"] }) {
  if (!roles || roles.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r.name}
          style={
            r.color
              ? { backgroundColor: `${r.color}22`, color: r.color, borderColor: `${r.color}66` }
              : undefined
          }
          className="rounded border border-white/15 bg-high px-1.5 py-px text-[10px] font-semibold uppercase"
        >
          {r.name}
        </span>
      ))}
    </span>
  );
}

function RankIcon({ index }: { index: number }) {
  if (index === 0) return <Trophy size={24} className="text-amber-300" />;
  if (index === 1) return <Medal size={24} className="text-zinc-300" />;
  if (index === 2) return <Award size={24} className="text-amber-600" />;
  return (
    <span className="font-display text-lg font-bold text-faint">
      {index + 1}.
    </span>
  );
}

function Avatar({ m, size = "h-11 w-11 text-lg" }: { m: Member; size?: string }) {
  if (m.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.avatar_url}
        alt={m.name}
        className={`${size} shrink-0 rounded-lg object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-highest font-display font-bold`}
    >
      {AVATAR[m.name] ?? m.name.charAt(0)}
    </span>
  );
}

function subtitleOf(m: Member): string {
  return m.subtitle || SUBTITLE[m.name] || "";
}

export default function LeaderboardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [mRes, fRes, sRes] = await Promise.all([
        fetch("/api/members", { cache: "no-store" }),
        fetch("/api/feed", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const mData = await mRes.json();
      if (!mRes.ok) throw new Error(mData.details ?? mData.error ?? "โหลดไม่สำเร็จ");
      const sorted = [...(mData.members as Member[])].sort(
        (a, b) => b.score - a.score
      );
      setMembers(sorted);
      setDemo(Boolean(mData.demo));
      if (fRes.ok) {
        const fData = await fRes.json();
        setFeed(fData.feed ?? []);
        setTotal(fData.total ?? 0);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.settings) setSettings(sData.settings);
      }
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
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const top = members.length > 0 ? members[0].score : 0;

  // ---- stat: ใครเกรียนสุด / ทำดีสุด / ฟอร์มล่าสุด ----
  const stats = useMemo(() => {
    if (members.length === 0) return null;
    const sortedAsc = [...members].sort((a, b) => a.score - b.score);
    const sortedDesc = [...members].sort((a, b) => b.score - a.score);
    const lowest = sortedAsc[0];
    const highest = sortedDesc[0];

    const negCount = new Map<string, number>();
    let plus = 0;
    let minus = 0;
    for (const f of feed) {
      if (f.delta > 0) plus += 1;
      else {
        minus += 1;
        negCount.set(f.name, (negCount.get(f.name) ?? 0) + 1);
      }
    }
    let menace: Member | null = null;
    let menaceHits = 0;
    for (const [name, n] of negCount) {
      if (n > menaceHits) {
        menaceHits = n;
        menace = members.find((s) => s.name === name) ?? null;
      }
    }
    const sum = plus + minus;
    const latestTroll = feed.find((f) => f.delta < 0 && f.reason);
    return {
      lowest,
      highest,
      menace,
      menaceHits,
      lowestRecentNeg: negCount.get(lowest.name) ?? 0,
      latestTroll: latestTroll ?? null,
      plus,
      minus,
      plusPct: sum === 0 ? 50 : Math.round((plus / sum) * 100),
    };
  }, [members, feed]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-sub">
              {settings.site_name} • {settings.site_tagline}
            </span>
            <span className="rounded bg-mint/10 px-2 py-0.5 text-[11px] font-semibold text-mint">
              LIVE
            </span>
          </div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Trophy size={28} className="text-amber-300" />
            Leaderboard
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
          โหมด demo — ยังไม่ได้ต่อ Supabase ตั้งค่า Env แล้วจะเห็นข้อมูลจริง (แก้ชื่อ/ฉายา/รูปได้ที่หน้า /edit)
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
        <>
          {stats && (
            <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-xl border border-softred/30 bg-softred/5 p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-softred/10 blur-2xl" />
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-softred">
                  <Flame size={14} />
                  เกรียนสุดตอนนี้
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Avatar m={stats.lowest} />
                  <div className="min-w-0">
                    <div className="truncate font-display font-bold leading-tight">
                      {stats.lowest.name}
                    </div>
                    <div className="text-[11px] text-sub">
                      {subtitleOf(stats.lowest)}
                    </div>
                  </div>
                  <span className="ml-auto font-mono text-2xl font-bold text-softred">
                    {stats.lowest.score}
                  </span>
                </div>
                <p className="mt-2 text-xs text-sub">
                  {feed.length > 0 ? (
                    <>
                      โดน <span className="font-bold text-softred">-{stats.lowestRecentNeg}</span> ใน {feed.length} โหวตล่าสุด
                      {stats.menace &&
                        stats.menace.name !== stats.lowest.name &&
                        stats.menaceHits > 0 && (
                          <>
                            {" "}• ฟอร์มแรงตอนนี้: <span className="font-semibold text-ink">{stats.menace.name}</span> โดนรัว {stats.menaceHits} ครั้ง
                          </>
                        )}
                    </>
                  ) : (
                    "คะแนนรวมต่ำสุดในแก๊ง — ระวังโดนลงทัณฑ์"
                  )}
                </p>
                {stats.latestTroll?.reason && (
                  <p className="mt-1 truncate text-xs text-sub">
                    ล่าสุด: <span className="font-semibold text-ink">{stats.latestTroll.name}</span>
                    {" "}โดนเพราะ “{stats.latestTroll.reason}”
                  </p>
                )}
              </div>

              <div className="relative overflow-hidden rounded-xl border border-mint/30 bg-mint/5 p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-mint/10 blur-2xl" />
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mint">
                  <Sparkles size={14} />
                  คนดีเด่นพุ่งแรง
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Avatar m={stats.highest} />
                  <div className="min-w-0">
                    <div className="truncate font-display font-bold leading-tight">
                      {stats.highest.name}
                    </div>
                    <div className="text-[11px] text-sub">
                      {subtitleOf(stats.highest)}
                    </div>
                  </div>
                  <span className="ml-auto font-mono text-2xl font-bold text-mint">
                    +{stats.highest.score}
                  </span>
                </div>
                <p className="mt-2 text-xs text-sub">
                  นำห่างที่ 2 อยู่{" "}
                  <span className="font-bold text-ink">
                    {members.length > 1 ? stats.highest.score - members[1].score : 0} แต้ม
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-low p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sub">
                  <Swords size={14} />
                  สมรภูมิโหวต
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold">
                    {total > 0 ? total.toLocaleString() : stats.plus + stats.minus}
                  </span>
                  <span className="text-xs text-faint">โหวตทั้งหมด</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase">
                  <span className="text-mint">ทำดี {stats.plusPct}%</span>
                  <span className="text-softred">เกรียน {100 - stats.plusPct}%</span>
                </div>
                <div className="mt-1 flex h-2 w-full overflow-hidden rounded bg-high">
                  <div className="h-full bg-mint" style={{ width: `${stats.plusPct}%` }} />
                  <div className="h-full bg-softred" style={{ width: `${100 - stats.plusPct}%` }} />
                </div>
                <p className="mt-2 text-xs text-sub">
                  +{stats.plus} ทำดี • -{stats.minus} เกรียน (ล่าสุด {feed.length})
                </p>
              </div>
            </section>
          )}

          <ol className="mt-6 space-y-3">
          {members.map((s, i) => {
            const pct =
              top > 0 ? Math.max(4, (s.score / top) * 100) : 4;
            const neg = s.score < 0;
            return (
              <li
                key={s.name}
                style={
                  s.bg_url
                    ? {
                        backgroundImage: `url(${s.bg_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
                className={`relative flex items-center gap-4 overflow-hidden rounded-xl border p-4 transition-colors ${
                  i === 0
                    ? "border-mint/50 bg-mint/5"
                    : "border-white/10 bg-low hover:bg-panel"
                }`}
              >
                {s.bg_url && (
                  <div className="pointer-events-none absolute inset-0 bg-black/70" />
                )}
                <span className="relative flex w-10 shrink-0 items-center justify-center">
                  <RankIcon index={i} />
                </span>
                <span className="relative">
                  <Avatar m={s} />
                </span>
                <div className="relative flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display font-bold">
                      {s.name}
                      {subtitleOf(s) && (
                        <span className="ml-2 text-xs font-normal text-sub">
                          {subtitleOf(s)}
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono text-xl font-semibold ${
                        neg ? "text-softred" : "text-mint"
                      }`}
                    >
                      {s.score}
                    </span>
                  </div>
                  {(s.roles?.length > 0) && (
                    <div className="mt-1.5">
                      <RoleChips roles={s.roles} />
                    </div>
                  )}
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
        </>
      )}

      <footer className="mt-8 border-t border-white/10 py-4 text-center text-xs text-faint">
        {settings.site_name} REPUTATION PROTOCOL • กด +1 / -1 ได้ไม่จำกัด • ติดลบได้ •
        ไม่มีรีเซ็ต
      </footer>
    </main>
  );
}
