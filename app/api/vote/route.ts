import { NextResponse } from "next/server";
import { isMember } from "@/lib/members";
import { isSheetsConfigured, voteAndGetScores } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { name?: string; delta?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { name, delta } = body;
  if (!name || !isMember(name)) {
    return NextResponse.json({ error: "ชื่อไม่ถูกต้อง" }, { status: 400 });
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta ต้องเป็น 1 หรือ -1" }, { status: 400 });
  }

  if (!isSheetsConfigured()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า Supabase บน server" },
      { status: 503 }
    );
  }

  try {
    const scores = await voteAndGetScores(name, delta);
    return NextResponse.json({ scores });
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "บันทึกโหวตไม่ได้", details },
      { status: 500 }
    );
  }
}
