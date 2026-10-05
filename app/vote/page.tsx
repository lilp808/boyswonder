"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChartColumn,
  Flame,
  Gavel,
  Pencil,
  Search,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Vote,
} from "lucide-react";
import { AVATAR, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/members";

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

type SortMode = "all" | "neg" | "pos";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "เมื่อสักครู่";
  const s = Math.floor(ms / 1000);
  if (s < 60) return "เมื่อสักครู่";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

function badgeOf(score: number): { text: string; cls: string } {
  if (score < 0)
    return { text: `ติดลบ (${score})`, cls: "bg-softred/10 text-softred" };
  if (score > 0)
    return { text: `ทำดี (${score})`, cls: "bg-mint/10 text-mint" };
  return { text: "สถานะปกติ", cls: "bg-high text-sub" };
}

function scoreColor(score: number): string {
  if (score < 0) return "text-softred";
  if (score > 0) return "text-mint";
  return "text-ink";
}

function Avatar({ m }: { m: Member }) {  if (m.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.avatar_url}
        alt={m.name}
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-highest">
      <span className="font-display text-lg font-bold">
        {AVATAR[m.name] ?? m.name.charAt(0)}
      </span>
      {m.score < 0 && (
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-softred" />
      )}
    </div>
  );
}

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

export default function VotePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("all");
  const [latency, setLatency] = useState<number | null>(null);
  const [trollTarget, setTrollTarget] = useState<{ name: string; delta: 1 | -1 } | null>(null);
  const [trollReason, setTrollReason] = useState("");

  function openVoteForm(s: Member, delta: 1 | -1) {
    if (trollTarget?.name === s.name && trollTarget?.delta === delta) {
      setTrollTarget(null);
    } else {
      setTrollTarget({ name: s.name, delta });
      setTrollReason("");
    }
  }

  const refresh = useCallback(async () => {
    const t0 = performance.now();
    try {
      const [mRes, fRes, sRes] = await Promise.all([
        fetch("/api/members", { cache: "no-store" }),
        fetch("/api/feed", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const mData = await mRes.json();
      const fData = fRes.ok ? await fRes.json() : null;
      if (!mRes.ok) throw new Error(mData.details ?? mData.error ?? "โหลดไม่สำเร็จ");
      setMembers(mData.members);
      if (fData) {
        setFeed(fData.feed ?? []);
        setTotal(fData.total ?? 0);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.settings) setSettings(sData.settings);
      }
      setError("");
      setLatency(Math.round(performance.now() - t0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ซิงค์คะแนน + ฟีดกับ server
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  async function vote(name: string, delta: 1 | -1, reason = "") {
    if (busy) return;
    const why = reason.trim();
    if (!why) {
      setError(
        delta === -1
          ? "กด -1 ต้องใส่เหตุผลด้วยว่าเกรียนเรื่องอะไร"
          : "กด +1 ต้องใส่เหตุผลด้วยว่าทำดีเรื่องอะไร"
      );
      return;
    }
    setBusy(true);
    setMembers((prev) =>
      prev.map((s) => (s.name === name ? { ...s, score: s.score + delta } : s))
    );
    setFeed((prev) =>
      [{ t: new Date().toISOString(), name, delta, reason: why }, ...prev].slice(0, 15)
    );
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, delta, reason: why }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "โหวตไม่สำเร็จ");
      setTrollTarget(null);
      setTrollReason("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหวตไม่สำเร็จ");
      refresh();
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = members.filter((s) => s.name.toLowerCase().includes(q));
    if (sort === "neg") list = [...list].sort((a, b) => a.score - b.score);
    else if (sort === "pos") list = [...list].sort((a, b) => b.score - a.score);
    return list;
  }, [members, query, sort]);

  const lowest = useMemo(() => {
    if (members.length === 0) return null;
    return [...members].sort((a, b) => a.score - b.score)[0];
  }, [members]);

  const plus = feed.filter((f) => f.delta > 0).length;
  const minus = feed.filter((f) => f.delta < 0).length;
  const sum = plus + minus;
  const plusPct = sum === 0 ? 50 : Math.round((plus / sum) * 100);

  const chip = (mode: SortMode, label: string) => (
    <button
      key={mode}
      onClick={() => setSort(mode)}
      className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
        sort === mode
          ? "bg-high text-ink"
          : "bg-low text-sub hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6">
      {/* Hero */}
      <section className="mb-6">
        <div className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-xl bg-lowest p-6 shadow-md lg:flex-row lg:items-center">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-high/40 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-high text-ink">
                <Vote size={18} />
              </div>
              <span className="text-xs uppercase tracking-wider text-sub">
                {settings.site_name} • {settings.site_tagline}
              </span>
              <span className="rounded bg-mint/10 px-2 py-0.5 text-xs font-semibold text-mint">
                LIVE ACTIVE
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {settings.vote_title}
            </h1>
            <p className="max-w-2xl text-sm text-sub">
              {settings.vote_subtitle} •{" "}
              <span className="font-semibold text-mint">+1 ถ้าทำดี</span> /{" "}
              <span className="font-semibold text-softred">-1 ถ้าเกรียน</span> •{" "}
              <span className="text-ink underline decoration-white/20 underline-offset-4">
                ติดลบได้ไร้ขีดจำกัด
              </span>
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-3">
            <div className="flex flex-col rounded-lg bg-panel px-4 py-2">
              <span className="text-[11px] uppercase text-faint">
                ยอดโหวตรวม
              </span>
              <span className="font-display text-xl font-bold tracking-tight">
                {loading ? "…" : total.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col rounded-lg bg-panel px-4 py-2">
              <span className="text-[11px] uppercase text-faint">
                เกรียนสุด ({lowest?.score ?? "–"})
              </span>
              <div className="flex items-center gap-1">
                <span className="font-display text-xl font-bold tracking-tight text-softred">
                  {loading ? "…" : (lowest?.name ?? "–")}
                </span>
                <Flame size={18} className="text-softred" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`ค้นหาเพื่อนในแก๊ง ${settings.site_name}...`}
            className="w-full rounded-lg bg-lowest py-2 pl-10 pr-4 text-sm text-ink placeholder-faint transition-all focus:bg-panel focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="mr-1 shrink-0 text-xs uppercase text-faint">
            เรียงตาม:
          </span>
          {chip("all", `ทั้งหมด (${members.length})`)}
          {chip("neg", "คะแนนติดลบ")}
          {chip("pos", "แต้มบวกมากสุด")}
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-xl border border-softred/40 bg-softred/10 px-4 py-3 text-sm text-softred">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-8">
          {loading ? (
            <p className="col-span-full py-10 text-center text-sm text-faint">
              กำลังโหลด…
            </p>
          ) : visible.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-faint">
              ไม่เจอชื่อที่ค้นหา
            </p>
          ) : (
            visible.map((s) => {
              const badge = badgeOf(s.score);
              return (
                <div
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
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-low p-4 shadow-sm transition-all duration-200 hover:bg-panel"
                >
                  {s.bg_url && (
                    <div className="pointer-events-none absolute inset-0 bg-black/70" />
                  )}
                  {s.score < 0 && (
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-softred/5 blur-2xl" />
                  )}
                  <div className="relative mb-4 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar m={s} />
                      <div className="flex min-w-0 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-display font-bold">
                            {s.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${badge.cls}`}
                          >
                            {badge.text}
                          </span>
                        </div>
                        <span className="text-xs text-sub">
                          {s.subtitle}
                        </span>
                        {s.roles?.length > 0 && (
                          <span className="mt-1">
                            <RoleChips roles={s.roles} />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span
                        className={`font-display text-4xl font-bold leading-none tracking-tighter ${scoreColor(s.score)}`}
                      >
                        {s.score}
                      </span>
                      <span className="text-[11px] uppercase text-faint">
                        คะแนนสะสม
                      </span>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-2 gap-2 pt-1">
                    <button
                      disabled={busy}
                      onClick={() => openVoteForm(s, -1)}
                      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2.5 font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-40 ${
                        trollTarget?.name === s.name && trollTarget?.delta === -1
                          ? "bg-softred text-black"
                          : "bg-softred/10 text-softred hover:bg-softred hover:text-black"
                      }`}
                    >
                      <ThumbsDown size={20} />
                      -1 เกรียน
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => openVoteForm(s, 1)}
                      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2.5 font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-40 ${
                        trollTarget?.name === s.name && trollTarget?.delta === 1
                          ? "bg-mint text-black"
                          : "bg-highest text-ink hover:bg-mint hover:text-black"
                      }`}
                    >
                      <ThumbsUp size={20} />
                      +1 ทำดี
                    </button>
                  </div>
                  {trollTarget?.name === s.name && (
                    <div className="relative mt-2 flex gap-2">
                      <input
                        value={trollReason}
                        onChange={(e) => setTrollReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") vote(s.name, trollTarget.delta, trollReason);
                        }}
                        placeholder={
                          trollTarget.delta === -1
                            ? "เกรียนเรื่องอะไร… (ต้องใส่)"
                            : "ทำดีเรื่องอะไร… (ต้องใส่)"
                        }
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg bg-lowest px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none"
                      />
                      <button
                        disabled={busy || !trollReason.trim()}
                        onClick={() => vote(s.name, trollTarget.delta, trollReason)}
                        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40 ${
                          trollTarget.delta === -1 ? "bg-softred" : "bg-mint"
                        }`}
                      >
                        ยืนยัน {trollTarget.delta === -1 ? "-1" : "+1"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Aside */}
        <div className="flex flex-col gap-5 xl:col-span-4">
          <div className="flex flex-col rounded-xl bg-low p-4 shadow-md">
            <div className="mb-3 flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-ping rounded-full bg-mint" />
                <span className="font-display font-bold">ฟีดการโหวตสด</span>
              </div>
              <span className="text-[11px] uppercase text-faint">
                Real-Time Sync
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {feed.length === 0 ? (
                <p className="py-4 text-center text-xs text-faint">
                  {loading ? "กำลังโหลด…" : "ยังไม่มีโหวต — กดเป็นคนแรกเลย"}
                </p>
              ) : (
                feed.slice(0, 7).map((f, i) => {
                  const pos = f.delta > 0;
                  return (
                    <div
                      key={`${f.t}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-lowest p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {pos ? (
                          <BadgeCheck
                            size={16}
                            className="shrink-0 text-mint"
                          />
                        ) : (
                          <TriangleAlert
                            size={16}
                            className="shrink-0 text-softred"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {f.name}
                          </span>
                          {f.reason && (
                            <span className="block truncate text-[11px] text-sub">
                              เพราะ {f.reason}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${pos ? "bg-mint/10 text-mint" : "bg-softred/10 text-softred"}`}
                        >
                          {pos ? "+1 ทำดี" : "-1 เกรียน"}
                        </span>
                        <span className="text-[11px] text-faint">
                          {relativeTime(f.t)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-display font-bold">
                  สถิติความเกรียน vs ทำดี
                </span>
                <span className="text-[11px] text-faint">
                  จากฟีดล่าสุด {sum} โหวต
                </span>
              </div>
              <ChartColumn size={20} className="text-faint" />
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-lowest p-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase">
                <span className="text-mint">ทำดี {plusPct}%</span>
                <span className="text-softred">เกรียน {100 - plusPct}%</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded bg-high">
                <div className="h-full bg-mint" style={{ width: `${plusPct}%` }} />
                <div
                  className="h-full bg-softred"
                  style={{ width: `${100 - plusPct}%` }}
                />
              </div>
              <svg className="h-12 w-full text-ink" fill="none" viewBox="0 0 200 40">
                <path
                  d="M0 35 L20 28 L40 32 L60 18 L80 25 L100 8 L120 15 L140 5 L160 22 L180 12 L200 28"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  d="M0 35 L20 28 L40 32 L60 18 L80 25 L100 8 L120 15 L140 5 L160 22 L180 12 L200 28 L200 40 L0 40 Z"
                  fill="currentColor"
                  fillOpacity="0.05"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-high/40 p-3 text-sm text-sub">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Gavel size={16} />
                <span className="text-xs uppercase">
                  กฎการลงทัณฑ์ประจำสัปดาห์
                </span>
              </div>
              <p className="leading-relaxed">
                {settings.rule_text}
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/10 py-4 text-xs text-sub md:flex-row">
        <div>{settings.site_name} REPUTATION PROTOCOL • CONDUCT MATRIX ENGINE</div>
        <div className="flex items-center gap-3">
          <span>STATUS: SYNCHRONIZED</span>
          <span className="text-faint">|</span>
          <span>LATENCY: {latency === null ? "–" : `${latency}MS`}</span>
          <span className="text-faint">|</span>
          <Link
            href="/edit"
            className="flex items-center gap-1 text-faint transition-colors hover:text-ink"
          >
            <Pencil size={12} />
            edit
          </Link>
        </div>
      </footer>
    </main>
  );
}
