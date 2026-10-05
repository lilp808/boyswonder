import { NextResponse } from "next/server";
import { MEMBERS, SUBTITLE } from "@/lib/members";
import { getMembersWithScores, isSheetsConfigured } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!isSheetsConfigured()) {
    return NextResponse.json({
      members: MEMBERS.map((name, i) => ({
        name,
        subtitle: SUBTITLE[name] ?? "",
        avatar_url: "",
        sort_order: i,
        is_active: true,
        score: 0,
      })),
      demo: true,
    });
  }
  try {
    const members = await getMembersWithScores();
    return NextResponse.json({ members: members.filter((m) => m.is_active) });
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อ่านสมาชิกไม่ได้", details },
      { status: 500 }
    );
  }
}
