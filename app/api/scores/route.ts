import { NextResponse } from "next/server";
import { MEMBERS } from "@/lib/members";
import { getScores, isSheetsConfigured } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // โหมด demo: ยังไม่ตั้งค่า Sheet จะได้เปิดเว็บเทส UI ได้ก่อน
  if (!isSheetsConfigured()) {
    return NextResponse.json({
      scores: MEMBERS.map((name) => ({ name, score: 0 })),
      demo: true,
      message: "ยังไม่ได้ตั้งค่า Supabase — กำลังแสดงโหมด demo",
    });
  }

  try {
    const scores = await getScores();
    return NextResponse.json({ scores });
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อ่านคะแนนไม่ได้", details },
      { status: 500 }
    );
  }
}
