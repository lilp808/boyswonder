import { NextResponse } from "next/server";
import {
  getSettings,
  isSheetsConfigured,
  requireAdmin,
  saveSettings,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string; settings?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const pw = body.password ?? req.headers.get("x-admin-password") ?? "";
    requireAdmin(pw);
    if (!isSheetsConfigured()) throw new Error("ยังไม่ได้ตั้งค่า Supabase บน server");
    const settings = await saveSettings(body.settings ?? {});
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "บันทึกตั้งค่าไม่ได้", details }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const pw =
      req.headers.get("x-admin-password") ??
      new URL(req.url).searchParams.get("password") ??
      "";
    requireAdmin(pw);
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "อ่านตั้งค่าไม่ได้", details }, { status: 401 });
  }
}
