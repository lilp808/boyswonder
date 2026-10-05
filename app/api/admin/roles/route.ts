import { NextResponse } from "next/server";
import {
  addRole,
  deleteRole,
  getRoles,
  isSheetsConfigured,
  requireAdmin,
  updateRole,
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

export async function GET(req: Request) {
  try {
    auth(req);
    const roles = await getRoles();
    return NextResponse.json({ roles });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน|เข้าไม่ได้/.test(details) ? 401 : 500;
    return NextResponse.json({ error: "อ่าน role ไม่ได้", details }, { status });
  }
}

export async function POST(req: Request) {
  let body: { password?: string; name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    auth(req, body);
    await addRole({ name: body.name ?? "", color: body.color ?? "" });
    const roles = await getRoles();
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "เพิ่ม role ไม่ได้", details }, { status });
  }
}

export async function PUT(req: Request) {
  let body: {
    password?: string;
    oldName?: string;
    name?: string;
    color?: string;
    sort_order?: number;
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
    await updateRole(body.oldName, {
      name: body.name,
      color: body.color,
      sort_order: body.sort_order,
    });
    const roles = await getRoles();
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "แก้ไข role ไม่ได้", details }, { status });
  }
}

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
    await deleteRole(body.name);
    const roles = await getRoles();
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "ลบ role ไม่ได้", details }, { status });
  }
}
