import { NextResponse } from "next/server";
import { getMemberHistory, isSheetsConfigured } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isSheetsConfigured()) {
    return NextResponse.json({ history: [], plusTotal: 0, minusTotal: 0, demo: true });
  }
  try {
    const u = new URL(req.url);
    const name = u.searchParams.get("name") ?? "";
    const limit = Number(u.searchParams.get("limit") ?? "30");
    if (!name.trim()) {
      return NextResponse.json({ error: "ต้องระบุชื่อ" }, { status: 400 });
    }
    const data = await getMemberHistory(name, Number.isFinite(limit) ? limit : 30);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อ่านประวัติไม่ได้", details },
      { status: 500 }
    );
  }
}
