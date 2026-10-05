"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  Users,
  Globe,
  LogOut,
} from "lucide-react";
import { AVATAR, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/members";

type Member = {
  name: string;
  subtitle: string;
  avatar_url: string;
  sort_order: number;
  is_active: boolean;
  score: number;
};

const PW_KEY = "bw-admin-pw";

function headers(pw: string): HeadersInit {
  return { "Content-Type": "application/json", "x-admin-password": pw };
}

function AvatarPreview({ m }: { m: Pick<Member, "name" | "avatar_url"> }) {
  if (m.avatar_url) {
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
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-highest font-display text-lg font-bold">
      {AVATAR[m.name] ?? m.name.charAt(0)}
    </span>
  );
}

export default function EditPage() {
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<"members" | "site">("members");

  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // ฟอร์มเพิ่มสมาชิก
  const [newName, setNewName] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  const flash = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(""), 2500);
  };

  const loadAll = useCallback(async (password: string) => {
    setLoading(true);
    setError("");
    try {
      const [mRes, sRes] = await Promise.all([
        fetch("/api/admin/members", { headers: { "x-admin-password": password }, cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const mData = await mRes.json();
      if (!mRes.ok) throw new Error(mData.details ?? mData.error ?? "โหลดสมาชิกไม่ได้");
      setMembers(mData.members ?? []);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.settings) setSettings(sData.settings);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่ได้");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // จำรหัสใน session + ลองปลดล็อกอัตโนมัติ
  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPw(saved);
    setAuthBusy(true);
    fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: saved }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.details ?? d.error ?? "รหัสไม่ถูก");
        setUnlocked(true);
        await loadAll(saved).catch(() => setUnlocked(true));
      })
      .catch(() => sessionStorage.removeItem(PW_KEY))
      .finally(() => setAuthBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(e?: React.FormEvent) {
    e?.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "เข้าไม่ได้");
      sessionStorage.setItem(PW_KEY, pw);
      setUnlocked(true);
      await loadAll(pw);
      if (data.demo) setError("รหัสถูก แต่ยังไม่ได้ต่อ Supabase — ข้อมูลที่เห็นคือ demo");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "เข้าไม่ได้");
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(PW_KEY);
    setPw("");
    setUnlocked(false);
    setMembers([]);
  }

  async function uploadAvatar(file: File, apply: (url: string) => void, key: string) {
    setUploading(key);
    setError("");
    try {
      const form = new FormData();
      form.append("password", pw);
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "อัปโหลดไม่ได้");
      apply(data.url);
      flash("อัปโหลดรูปแล้ว — อย่าลืมกดบันทึก");
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่ได้");
    } finally {
      setUploading(null);
    }
  }

  async function addNew() {
    if (!newName.trim()) {
      setError("ต้องใส่ชื่อก่อน");
      return;
    }
    setSaving("new");
    setError("");
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: headers(pw),
        body: JSON.stringify({ name: newName.trim(), subtitle: newSub.trim(), avatar_url: newAvatar.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "เพิ่มไม่ได้");
      setMembers(data.members ?? []);
      setNewName("");
      setNewSub("");
      setNewAvatar("");
      flash("เพิ่มสมาชิกแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่ได้");
    } finally {
      setSaving(null);
    }
  }

  async function saveMember(m: Member, patch: Partial<Member> & { newName?: string }) {
    setSaving(m.name);
    setError("");
    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: headers(pw),
        body: JSON.stringify({
          oldName: m.name,
          name: patch.newName ?? m.name,
          subtitle: patch.subtitle ?? m.subtitle,
          avatar_url: patch.avatar_url ?? m.avatar_url,
          sort_order: patch.sort_order ?? m.sort_order,
          is_active: patch.is_active ?? m.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "บันทึกไม่ได้");
      setMembers(data.members ?? []);
      flash(`บันทึก ${patch.newName ?? m.name} แล้ว`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่ได้");
    } finally {
      setSaving(null);
    }
  }

  async function removeMember(m: Member, hard: boolean) {
    const label = hard ? `ลบ ${m.name} ถาวร (พร้อมคะแนน) ใช่ไหม?` : `ปิดใช้งาน ${m.name} ใช่ไหม? (ซ่อนจากหน้าโหวต)`;
    if (!confirm(label)) return;
    setSaving(m.name);
    setError("");
    try {
      const res = await fetch(`/api/admin/members${hard ? "?hard=1" : ""}`, {
        method: "DELETE",
        headers: headers(pw),
        body: JSON.stringify({ name: m.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "ลบไม่ได้");
      setMembers(data.members ?? []);
      flash(hard ? "ลบถาวรแล้ว" : "ปิดใช้งานแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่ได้");
    } finally {
      setSaving(null);
    }
  }

  async function saveSettings() {
    setSaving("settings");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: headers(pw),
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ?? data.error ?? "บันทึกไม่ได้");
      if (data.settings) setSettings(data.settings);
      flash("บันทึกข้อมูลเว็บแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่ได้");
    } finally {
      setSaving(null);
    }
  }

  // ---------- หน้าล็อก ----------
  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center px-4 py-16">
        <div className="w-full rounded-xl border border-white/10 bg-low p-6">
          <div className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
            <Lock size={18} className="text-faint" />
            พื้นที่ลับ
          </div>
          <p className="mb-4 text-sm text-sub">
            เพจนี้ไม่มีลิงก์จากหน้าไหน — ต้องพิมพ์รหัสผ่านเองถึงจะแก้ข้อมูลได้
          </p>
          <form onSubmit={unlock} className="flex flex-col gap-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="พิมพ์รหัสผ่านแอดมิน…"
              autoFocus
              className="w-full rounded-lg bg-lowest px-4 py-2.5 text-sm text-ink placeholder-faint focus:bg-panel focus:outline-none"
            />
            {authError && <p className="text-sm text-softred">{authError}</p>}
            <button
              type="submit"
              disabled={authBusy || !pw}
              className="flex items-center justify-center gap-2 rounded-lg bg-mint px-4 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
            >
              {authBusy && <Loader2 size={16} className="animate-spin" />}
              ปลดล็อก
            </button>
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            รหัสเก็บใน Env <span className="font-mono">ADMIN_PASSWORD</span> ฝั่ง server เท่านั้น — ตั้งใน Vercel → Settings → Environment Variables แล้ว redeploy
          </p>
        </div>
      </main>
    );
  }

  // ---------- หน้าจัดการ ----------
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-sub">BOYS WONDER • SECRET ADMIN</p>
          <h1 className="font-display text-2xl font-bold">แก้ไขข้อมูลเว็บ</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg bg-high px-4 py-2 text-sm font-semibold text-sub hover:text-ink"
        >
          <LogOut size={15} />
          ล็อกออก
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab("members")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${tab === "members" ? "bg-high text-ink" : "bg-low text-sub hover:text-ink"}`}
        >
          <Users size={15} />
          สมาชิก ({members.length})
        </button>
        <button
          onClick={() => setTab("site")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${tab === "site" ? "bg-high text-ink" : "bg-low text-sub hover:text-ink"}`}
        >
          <Globe size={15} />
          ข้อมูลเว็บ
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-softred/40 bg-softred/10 px-4 py-3 text-sm text-softred">
          {error}
        </div>
      )}
      {ok && (
        <div className="mt-4 rounded-xl border border-mint/40 bg-mint/10 px-4 py-3 text-sm text-mint">
          {ok}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-faint">กำลังโหลด…</p>
      ) : tab === "members" ? (
        <section className="mt-4 flex flex-col gap-3">
          {/* เพิ่มสมาชิก */}
          <div className="rounded-xl border border-mint/30 bg-mint/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Plus size={16} className="text-mint" />
              เพิ่มสมาชิกใหม่
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อ เช่น น้องใหม่" className="rounded-lg bg-lowest px-3 py-2 text-sm placeholder-faint focus:outline-none" />
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="ฉายา เช่น สายป่วน" className="rounded-lg bg-lowest px-3 py-2 text-sm placeholder-faint focus:outline-none" />
              <input value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)} placeholder="ลิงก์รูป (หรือกดอัปโหลด)" className="rounded-lg bg-lowest px-3 py-2 text-sm placeholder-faint focus:outline-none" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-high px-3 py-2 text-xs font-semibold hover:bg-highest">
                <ImagePlus size={14} />
                {uploading === "new" ? "กำลังอัปโหลด…" : "อัปโหลดรูป"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading === "new"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f, setNewAvatar, "new");
                    e.target.value = "";
                  }}
                />
              </label>
              {newAvatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={newAvatar} alt="preview" className="h-9 w-9 rounded-lg object-cover" />
              )}
              <button
                onClick={addNew}
                disabled={saving === "new" || !newName.trim()}
                className="ml-auto rounded-lg bg-mint px-5 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
              >
                {saving === "new" ? "กำลังเพิ่ม…" : "เพิ่มเลย"}
              </button>
            </div>
          </div>

          {/* รายการสมาชิก */}
          {members.map((m) => (
            <MemberRow
              key={m.name}
              m={m}
              busy={saving === m.name}
              uploading={uploading === m.name}
              onSave={saveMember}
              onDelete={removeMember}
              onUpload={(f, apply) => uploadAvatar(f, apply, m.name)}
            />
          ))}
          {members.length === 0 && (
            <p className="py-8 text-center text-sm text-faint">ยังไม่มีสมาชิก</p>
          )}
        </section>
      ) : (
        <section className="mt-4 rounded-xl border border-white/10 bg-low p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase text-faint">ชื่อเว็บ</span>
              <input value={settings.site_name} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase text-faint">คำต่อท้าย (tagline)</span>
              <input value={settings.site_tagline} onChange={(e) => setSettings({ ...settings, site_tagline: e.target.value })} className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase text-faint">หัวข้อหน้าโหวต</span>
              <input value={settings.vote_title} onChange={(e) => setSettings({ ...settings, vote_title: e.target.value })} className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase text-faint">คำอธิบายหน้าโหวต</span>
              <input value={settings.vote_subtitle} onChange={(e) => setSettings({ ...settings, vote_subtitle: e.target.value })} className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase text-faint">แต้มขั้นต่ำโดนลงทัณฑ์ (เช่น -10)</span>
              <input value={settings.rule_threshold} onChange={(e) => setSettings({ ...settings, rule_threshold: e.target.value })} className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase text-faint">กฎลงทัณฑ์ประจำสัปดาห์</span>
            <textarea
              value={settings.rule_text}
              onChange={(e) => setSettings({ ...settings, rule_text: e.target.value })}
              rows={3}
              className="rounded-lg bg-lowest px-3 py-2 text-sm leading-relaxed focus:outline-none"
            />
          </label>
          <button
            onClick={saveSettings}
            disabled={saving === "settings"}
            className="mt-3 flex items-center gap-2 rounded-lg bg-mint px-5 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
          >
            <Save size={15} />
            {saving === "settings" ? "กำลังบันทึก…" : "บันทึกข้อมูลเว็บ"}
          </button>
        </section>
      )}

      <footer className="mt-8 border-t border-white/10 py-4 text-center text-xs text-faint">
        SECRET ADMIN • ไม่ลิงก์จากหน้าไหน • รหัสอยู่ใน Env เท่านั้น
      </footer>
    </main>
  );
}

function MemberRow({
  m,
  busy,
  uploading,
  onSave,
  onDelete,
  onUpload,
}: {
  m: Member;
  busy: boolean;
  uploading: boolean;
  onSave: (m: Member, patch: Partial<Member> & { newName?: string }) => void;
  onDelete: (m: Member, hard: boolean) => void;
  onUpload: (f: File, apply: (url: string) => void) => void;
}) {
  const [name, setName] = useState(m.name);
  const [subtitle, setSubtitle] = useState(m.subtitle);
  const [avatar, setAvatar] = useState(m.avatar_url);
  const [order, setOrder] = useState(m.sort_order);
  const [active, setActive] = useState(m.is_active);
  const dirty =
    name !== m.name || subtitle !== m.subtitle || avatar !== m.avatar_url || order !== m.sort_order || active !== m.is_active;

  return (
    <div className={`rounded-xl border p-4 ${m.is_active ? "border-white/10 bg-low" : "border-white/5 bg-lowest opacity-70"}`}>
      <div className="flex items-center gap-3">
        <AvatarPreview m={{ name: m.name, avatar_url: avatar }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold">{m.name}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${m.score < 0 ? "bg-softred/10 text-softred" : "bg-mint/10 text-mint"}`}>
              {m.score} แต้ม
            </span>
            {!m.is_active && (
              <span className="rounded bg-high px-1.5 py-0.5 text-[11px] text-faint">ปิดใช้งาน</span>
            )}
          </div>
          <p className="truncate text-xs text-sub">{m.subtitle || "—"}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ" className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="ฉายา" className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none" />
        <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="ลิงก์รูปโปรไฟล์" className="rounded-lg bg-lowest px-3 py-2 text-sm focus:outline-none sm:col-span-2" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-sub">
          ลำดับ
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-16 rounded bg-lowest px-2 py-1 text-center focus:outline-none"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sub">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-emerald-400" />
          แสดงในหน้าเว็บ
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-high px-3 py-1.5 font-semibold text-sub hover:text-ink">
          <ImagePlus size={13} />
          {uploading ? "อัปโหลด…" : "อัปโหลดรูป"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f, setAvatar);
              e.target.value = "";
            }}
          />
        </label>
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="preview" className="h-7 w-7 rounded object-cover" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onSave(m, { newName: name.trim() || m.name, subtitle, avatar_url: avatar, sort_order: order, is_active: active })}
          disabled={busy || !dirty}
          className="flex items-center gap-1.5 rounded-lg bg-mint px-4 py-1.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-30"
        >
          <Save size={14} />
          {busy ? "บันทึก…" : "บันทึก"}
        </button>
        <button
          onClick={() => onDelete(m, false)}
          disabled={busy}
          className="rounded-lg bg-high px-4 py-1.5 text-sm font-semibold text-sub hover:text-ink disabled:opacity-30"
        >
          {m.is_active ? "ปิดใช้งาน" : "ซ่อนอยู่"}
        </button>
        <button
          onClick={() => onDelete(m, true)}
          disabled={busy}
          className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-softred/70 hover:bg-softred/10 hover:text-softred"
        >
          <Trash2 size={13} />
          ลบถาวร
        </button>
      </div>
    </div>
  );
}
