import { NextResponse } from "next/server";
import { isSheetsConfigured, requireAdmin } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    requireAdmin(body.password ?? "");
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "เข้าไม่ได้", details }, { status: 401 });
  }
  if (!isSheetsConfigured()) {
    return NextResponse.json(
      { ok: true, demo: true, message: "รหัสถูก แต่ยังไม่ได้ต่อ Supabase" }
    );
  }
  return NextResponse.json({ ok: true });
}
