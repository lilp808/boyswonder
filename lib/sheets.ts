import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  MEMBERS,
  SUBTITLE,
  isMember,
  type MemberProfile,
  type ScoreEntry,
  type SiteSettings,
} from "./members";

export type FeedEntry = {
  t: string;
  name: string;
  delta: number;
  reason: string;
};

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export function isSheetsConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---------- admin auth ----------
export function requireAdmin(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ยังไม่ได้ตั้งค่า ADMIN_PASSWORD บน server");
  }
  if (!password || password !== expected) {
    throw new Error("รหัสผ่านไม่ถูกต้อง");
  }
}

// ---------- scores (เดิม) ----------
function normalize(
  rows: { name: string; score: number | null }[],
  order: readonly string[] = MEMBERS
): ScoreEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r && typeof r.name === "string") map.set(r.name, r.score ?? 0);
  }
  return order.map((name) => ({ name, score: map.get(name) ?? 0 }));
}

export async function getScores(): Promise<ScoreEntry[]> {
  const { data, error } = await db().from("scores").select("name,score");
  if (error) throw new Error("อ่านคะแนนจาก Supabase ไม่ได้: " + error.message);
  // ถ้ามีตาราง members แล้ว ให้เรียงตามนั้น
  try {
    const members = await getMembersRaw();
    const order = members.map((m) => m.name);
    if (order.length > 0) return normalize(data ?? [], order);
  } catch {
    // ตาราง members อาจยังไม่มี — fallback เดิม
  }
  return normalize(data ?? []);
}

export async function voteAndGetScores(
  name: string,
  delta: 1 | -1,
  reason = ""
): Promise<ScoreEntry[]> {
  const clean = name.trim();
  if (!clean) throw new Error("ชื่อไม่ถูกต้อง");
  const why = reason.trim();
  // กดโหวต (+1 / -1) ต้องมีเหตุผลทุกครั้ง
  if (!why) throw new Error("กดโหวตต้องใส่เหตุผลด้วย");
  // ตรวจสมาชิกใน DB (ถ้ามีตาราง) — ต้อง active ถึงโหวตได้
  // ถ้าตาราง members ยังไม่มี (DB เก่าที่ยังไม่รัน migration) ให้ fallback เช็คลิสต์เดิม
  try {
    const members = await getMembersRaw();
    if (members.length > 0) {
      const found = members.find((m) => m.name === clean);
      if (!found) throw new Error("ไม่มีชื่อนี้ในสมาชิก");
      if (!found.is_active) throw new Error("สมาชิกคนนี้ถูกปิดใช้งานแล้ว");
    } else if (!isMember(clean)) {
      throw new Error("ชื่อไม่ถูกต้อง");
    }
  } catch (e) {
    if (e instanceof Error && /ไม่มีชื่อนี้|ปิดใช้งาน|ชื่อไม่ถูกต้อง/.test(e.message)) throw e;
    // อ่านตาราง members ไม่ได้ (เช่นยังไม่รัน migration) — fallback ลิสต์เดิมกันชื่อมั่ว
    if (!isMember(clean)) throw new Error("ชื่อไม่ถูกต้อง");
  }
  const { error } = await db().rpc("vote_member", {
    p_name: clean,
    p_delta: delta,
    p_reason: why,
  });
  if (error) {
    // fallback DB เก่าที่ยังไม่รัน migration (function ยังไม่รับ p_reason)
    if (!why) {
      const retry = await db().rpc("vote_member", {
        p_name: clean,
        p_delta: delta,
      });
      if (retry.error) throw new Error("บันทึกโหวตลง Supabase ไม่ได้: " + retry.error.message);
    } else {
      throw new Error("บันทึกโหวตไม่ได้ (DB ยังไม่รองรับเหตุผล — รัน schema.sql ใหม่ก่อน): " + error.message);
    }
  }
  return getScores();
}

export async function getMemberHistory(
  name: string,
  limit = 30
): Promise<{
  history: { t: string; delta: number; reason: string }[];
  plusTotal: number;
  minusTotal: number;
}> {
  const clean = name.trim();
  if (!clean) throw new Error("ต้องระบุชื่อ");
  const c = db();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  // ลองอ่านพร้อม reason ก่อน (DB ใหม่) ถ้าไม่ได้ค่อย fallback (DB เก่า)
  let rows: { created_at: string; delta: number; reason?: string }[] = [];
  const full = await c
    .from("votes_log")
    .select("created_at,delta,reason")
    .eq("name", clean)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (!full.error) {
    rows = (full.data ?? []) as typeof rows;
  } else {
    const { data, error } = await c
      .from("votes_log")
      .select("created_at,delta")
      .eq("name", clean)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) throw new Error("อ่านประวัติไม่ได้: " + error.message);
    rows = (data ?? []).map((r) => ({ ...(r as object), reason: "" }) as typeof rows[0]);
  }
  const [{ count: plusTotal }, { count: minusTotal }] = await Promise.all([
    c.from("votes_log").select("id", { count: "exact", head: true }).eq("name", clean).eq("delta", 1),
    c.from("votes_log").select("id", { count: "exact", head: true }).eq("name", clean).eq("delta", -1),
  ]);
  return {
    history: rows.map((r) => ({
      t: r.created_at,
      delta: r.delta,
      reason: r.reason ?? "",
    })),
    plusTotal: plusTotal ?? 0,
    minusTotal: minusTotal ?? 0,
  };
}

export async function getFeed(limit = 15): Promise<{
  feed: FeedEntry[];
  total: number;
}> {
  const c = db();
  // ลองอ่านพร้อม reason ก่อน (DB ใหม่) ถ้าไม่ได้ค่อย fallback แบบไม่มี reason (DB เก่า)
  const full = await c
    .from("votes_log")
    .select("created_at,name,delta,reason")
    .order("created_at", { ascending: false })
    .limit(limit);
  let rows: { created_at: string; name: string; delta: number; reason?: string }[] = [];
  if (!full.error) {
    rows = (full.data ?? []) as typeof rows;
  } else {
    const { data, error } = await c
      .from("votes_log")
      .select("created_at,name,delta")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("อ่านฟีดจาก Supabase ไม่ได้: " + error.message);
    rows = (data ?? []).map((r) => ({ ...(r as object), reason: "" }) as typeof rows[0]);
  }
  const { count } = await c.from("votes_log").select("id", { count: "exact", head: true });
  return {
    feed: rows.map((r) => ({
      t: r.created_at as string,
      name: r.name as string,
      delta: r.delta as number,
      reason: (r.reason as string) ?? "",
    })),
    total: count ?? 0,
  };
}

// ---------- members ----------
export type MemberRow = {
  name: string;
  subtitle: string;
  avatar_url: string;
  bg_url: string;
  sort_order: number;
  is_active: boolean;
};

export async function getMembersRaw(): Promise<MemberRow[]> {
  const { data, error } = await db()
    .from("members")
    .select("name,subtitle,avatar_url,bg_url,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    name: r.name as string,
    subtitle: (r.subtitle as string) ?? "",
    avatar_url: (r.avatar_url as string) ?? "",
    bg_url: ((r as Record<string, unknown>).bg_url as string) ?? "",
    sort_order: (r.sort_order as number) ?? 0,
    is_active: (r.is_active as boolean) ?? true,
  }));
}

export type RoleRow = { name: string; color: string; sort_order: number };

export async function getRolesRaw(): Promise<RoleRow[]> {
  const { data, error } = await db()
    .from("roles")
    .select("name,color,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    name: r.name as string,
    color: (r.color as string) ?? "",
    sort_order: (r.sort_order as number) ?? 0,
  }));
}

async function getRolesMap(): Promise<Map<string, { name: string; color: string }[]>> {
  try {
    const [roles, links] = await Promise.all([
      getRolesRaw(),
      db().from("member_roles").select("member_name,role_name"),
    ]);
    if (links.error) throw links.error;
    const colorOf = new Map(roles.map((r) => [r.name, r.color]));
    const map = new Map<string, { name: string; color: string }[]>();
    for (const l of links.data ?? []) {
      const mn = l.member_name as string;
      const rn = l.role_name as string;
      if (!mn || !rn) continue;
      const arr = map.get(mn) ?? [];
      arr.push({ name: rn, color: colorOf.get(rn) ?? "" });
      map.set(mn, arr);
    }
    return map as Map<string, { name: string; color: string }[]>;
  } catch {
    return new Map();
  }
}

export async function getMembersWithScores(): Promise<MemberProfile[]> {
  let rows: MemberRow[];
  try {
    rows = await getMembersRaw();
  } catch {
    // ตาราง members ยังไม่มี — fallback จาก scores + ค่าคงที่เดิม
    const scores = await getScores();
    return scores.map((s, i) => ({
      name: s.name,
      subtitle: SUBTITLE[s.name] ?? "",
      avatar_url: "",
      bg_url: "",
      roles: [],
      sort_order: i,
      is_active: true,
      score: s.score,
    }));
  }
  if (rows.length === 0) {
    const scores = await getScores();
    return scores.map((s, i) => ({
      name: s.name,
      subtitle: SUBTITLE[s.name] ?? "",
      avatar_url: "",
      bg_url: "",
      roles: [],
      sort_order: i,
      is_active: true,
      score: s.score,
    }));
  }
  const { data, error } = await db().from("scores").select("name,score");
  if (error) throw new Error("อ่านคะแนนจาก Supabase ไม่ได้: " + error.message);
  const map = new Map<string, number>();
  for (const r of data ?? []) map.set(r.name, r.score ?? 0);
  const rolesMap = await getRolesMap();
  return rows.map((m) => ({ ...m, roles: rolesMap.get(m.name) ?? [], score: map.get(m.name) ?? 0 }));
}

// ---------- roles ----------
export async function getRoles(): Promise<RoleRow[]> {
  try {
    return await getRolesRaw();
  } catch {
    return [];
  }
}

export async function addRole(input: { name: string; color?: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("ชื่อ role ห้ามว่าง");
  const { error } = await db()
    .from("roles")
    .insert({ name, color: (input.color ?? "").trim(), sort_order: 999 });
  if (error) throw new Error("เพิ่ม role ไม่ได้: " + error.message);
}

export async function updateRole(
  oldName: string,
  patch: { name?: string; color?: string; sort_order?: number }
): Promise<void> {
  const c = db();
  const newName = (patch.name ?? oldName).trim();
  if (!newName) throw new Error("ชื่อ role ห้ามว่าง");
  if (newName !== oldName) {
    // เปลี่ยนชื่อ role + พาประวัติการผูกไปด้วย (กัน DB ที่ FK cascade ยังไม่เข้า)
    const { error: linkErr } = await c
      .from("member_roles")
      .update({ role_name: newName })
      .eq("role_name", oldName);
    if (linkErr) throw new Error("เปลี่ยนชื่อ role ไม่ได้: " + linkErr.message);
    const { error } = await c.from("roles").update({ name: newName }).eq("name", oldName);
    if (error) throw new Error("เปลี่ยนชื่อ role ไม่ได้: " + error.message);
  }
  const update: Record<string, unknown> = {};
  if (patch.color !== undefined) update.color = patch.color.trim();
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (Object.keys(update).length === 0) return;
  const { error } = await c.from("roles").update(update).eq("name", newName);
  if (error) throw new Error("อัปเดต role ไม่ได้: " + error.message);
}

export async function deleteRole(name: string): Promise<void> {
  const c = db();
  // ลบการผูกก่อน (กัน DB ที่ FK cascade ยังไม่เข้า) แล้วค่อยลบ role
  await c.from("member_roles").delete().eq("role_name", name);
  const { error } = await c.from("roles").delete().eq("name", name);
  if (error) throw new Error("ลบ role ไม่ได้: " + error.message);
}

export async function setMemberRoles(memberName: string, roleNames: string[]): Promise<void> {
  const c = db();
  const clean = [...new Set(roleNames.map((r) => r.trim()).filter(Boolean))];
  const { error: delErr } = await c.from("member_roles").delete().eq("member_name", memberName);
  if (delErr) throw new Error("ตั้งค่า role ไม่ได้: " + delErr.message);
  if (clean.length === 0) return;
  const { error: insErr } = await c
    .from("member_roles")
    .insert(clean.map((role_name) => ({ member_name: memberName, role_name })));
  if (insErr) throw new Error("ตั้งค่า role ไม่ได้: " + insErr.message);
}

export async function addMember(input: {
  name: string;
  subtitle?: string;
  avatar_url?: string;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("ชื่อห้ามว่าง");
  const c = db();
  const { error: mErr } = await c.from("members").insert({
    name,
    subtitle: (input.subtitle ?? "").trim(),
    avatar_url: (input.avatar_url ?? "").trim(),
    sort_order: 999,
    is_active: true,
  });
  if (mErr) throw new Error("เพิ่มสมาชิกไม่ได้: " + mErr.message);
  const { error: sErr } = await c
    .from("scores")
    .upsert({ name, score: 0 }, { onConflict: "name" });
  if (sErr) throw new Error("สร้างคะแนนตั้งต้นไม่ได้: " + sErr.message);
}

export async function updateMember(
  oldName: string,
  patch: {
    name?: string;
    subtitle?: string;
    avatar_url?: string;
    bg_url?: string;
    sort_order?: number;
    is_active?: boolean;
    roles?: string[];
  }
): Promise<void> {
  const c = db();
  const newName = (patch.name ?? oldName).trim();
  if (!newName) throw new Error("ชื่อห้ามว่าง");
  if (newName !== oldName) {
    const { error } = await c.rpc("rename_member", {
      p_old: oldName,
      p_new: newName,
    });
    if (error) throw new Error("เปลี่ยนชื่อไม่ได้: " + error.message);
  }
  const update: Record<string, unknown> = {};
  if (patch.subtitle !== undefined) update.subtitle = patch.subtitle.trim();
  if (patch.avatar_url !== undefined) update.avatar_url = patch.avatar_url.trim();
  if (patch.bg_url !== undefined) update.bg_url = patch.bg_url.trim();
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  if (Object.keys(update).length > 0) {
    const { error } = await c.from("members").update(update).eq("name", newName);
    if (error) throw new Error("อัปเดตสมาชิกไม่ได้: " + error.message);
  }
  if (patch.roles !== undefined) {
    await setMemberRoles(newName, patch.roles);
  }
}

export type DeletedLogEntry = {
  id: number;
  name: string;
  reason: string;
  hard: boolean;
  t: string;
};

export async function getDeletedLog(limit = 20): Promise<DeletedLogEntry[]> {
  try {
    const { data, error } = await db()
      .from("deleted_log")
      .select("id,name,reason,hard,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as number,
      name: r.name as string,
      reason: (r.reason as string) ?? "",
      hard: Boolean(r.hard),
      t: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function deleteMember(name: string, hard = false, reason = ""): Promise<void> {
  const c = db();
  const why = reason.trim();
  if (hard) {
    if (!why) throw new Error("ลบถาวรต้องใส่เหตุผลด้วย");
    // เก็บประวัติก่อนลบจริง
    const { error: logErr } = await c
      .from("deleted_log")
      .insert({ name, reason: why, hard: true });
    if (logErr) throw new Error("บันทึกประวัติการลบไม่ได้: " + logErr.message);
    const { error: mErr } = await c.from("members").delete().eq("name", name);
    if (mErr) throw new Error("ลบสมาชิกไม่ได้: " + mErr.message);
    const { error: sErr } = await c.from("scores").delete().eq("name", name);
    if (sErr) throw new Error("ลบคะแนนไม่ได้: " + sErr.message);
  } else {
    if (why) {
      await c.from("deleted_log").insert({ name, reason: why, hard: false });
    }
    const { error } = await c
      .from("members")
      .update({ is_active: false })
      .eq("name", name);
    if (error) throw new Error("ปิดใช้งานสมาชิกไม่ได้: " + error.message);
  }
}

// ---------- site settings ----------
export async function getSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await db().from("site_settings").select("key,value");
    if (error) throw error;
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
    return {
      site_name: map.get("site_name") ?? DEFAULT_SETTINGS.site_name,
      site_tagline: map.get("site_tagline") ?? DEFAULT_SETTINGS.site_tagline,
      vote_title: map.get("vote_title") ?? DEFAULT_SETTINGS.vote_title,
      vote_subtitle: map.get("vote_subtitle") ?? DEFAULT_SETTINGS.vote_subtitle,
      rule_threshold: map.get("rule_threshold") ?? DEFAULT_SETTINGS.rule_threshold,
      rule_text: map.get("rule_text") ?? DEFAULT_SETTINGS.rule_text,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const c = db();
  const rows = Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));
  if (rows.length === 0) return getSettings();
  const { error } = await c.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error("บันทึกตั้งค่าไม่ได้: " + error.message);
  return getSettings();
}
