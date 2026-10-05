import { NextResponse } from "next/server";
import {
  addMember,
  deleteMember,
  getMembersWithScores,
  isSheetsConfigured,
  requireAdmin,
  updateMember,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getPassword(req: Request, body?: { password?: string }): string {
  const h = req.headers.get("x-admin-password");
  if (h) return h;
  if (body?.password) return body.password;
  try {
    const u = new URL(req.url);
    return u.searchParams.get("password") ?? "";
  } catch {
    return "";
  }
}

function auth(req: Request, body?: { password?: string }) {
  requireAdmin(getPassword(req, body));
  if (!isSheetsConfigured()) {
    throw new Error("ยังไม่ได้ตั้งค่า Supabase บน server");
  }
}

// ดูสมาชิกทั้งหมด (รวมคนโดนปิดใช้งาน) — ใช้ในหน้า /edit
export async function GET(req: Request) {
  try {
    auth(req);
    const members = await getMembersWithScores();
    return NextResponse.json({ members });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน|เข้าไม่ได้/.test(details) ? 401 : 500;
    return NextResponse.json({ error: "อ่านสมาชิกไม่ได้", details }, { status });
  }
}

// เพิ่มสมาชิกใหม่
export async function POST(req: Request) {
  let body: { password?: string; name?: string; subtitle?: string; avatar_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    auth(req, body);
    await addMember({
      name: body.name ?? "",
      subtitle: body.subtitle ?? "",
      avatar_url: body.avatar_url ?? "",
    });
    const members = await getMembersWithScores();
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "เพิ่มสมาชิกไม่ได้", details }, { status });
  }
}

// แก้ไขสมาชิก (เปลี่ยนชื่อ/ฉายา/รูป/ลำดับ/เปิด-ปิด)
export async function PUT(req: Request) {
  let body: {
    password?: string;
    oldName?: string;
    name?: string;
    subtitle?: string;
    avatar_url?: string;
    sort_order?: number;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.oldName) {
    return NextResponse.json({ error: "ต้องระบุ oldName" }, { status: 400 });
  }
  try {
    auth(req, body);
    await updateMember(body.oldName, {
      name: body.name,
      subtitle: body.subtitle,
      avatar_url: body.avatar_url,
      sort_order: body.sort_order,
      is_active: body.is_active,
    });
    const members = await getMembersWithScores();
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "แก้ไขสมาชิกไม่ได้", details }, { status });
  }
}

// ลบสมาชิก (?hard=1 = ลบถาวรพร้อมคะแนน, ปกติแค่ปิดใช้งาน)
export async function DELETE(req: Request) {
  let body: { password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.name) {
    return NextResponse.json({ error: "ต้องระบุชื่อ" }, { status: 400 });
  }
  try {
    auth(req, body);
    const u = new URL(req.url);
    const hard = u.searchParams.get("hard") === "1";
    await deleteMember(body.name, hard);
    const members = await getMembersWithScores();
    return NextResponse.json({ ok: true, members });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "ลบสมาชิกไม่ได้", details }, { status });
  }
}
