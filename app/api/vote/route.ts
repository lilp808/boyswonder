import { NextResponse } from "next/server";
import { isSheetsConfigured, voteAndGetScores } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { name?: string; delta?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { name, delta, reason } = body;
  // หมายเหตุ: ไม่เช็ครายชื่อ hardcode ตรงนี้ — ชื่อสมาชิกอยู่ในตาราง members
  // บน Supabase แล้ว (แก้ผ่านหน้า /edit) ให้ voteAndGetScores ตรวจกับ DB
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "ชื่อไม่ถูกต้อง" }, { status: 400 });
  }
  if (delta === -1 && !(typeof reason === "string" && reason.trim())) {
    return NextResponse.json(
      { error: "กด -1 ต้องใส่เหตุผลด้วยว่าเกรียนเรื่องอะไร" },
      { status: 400 }
    );
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
    const scores = await voteAndGetScores(name, delta, reason ?? "");
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
