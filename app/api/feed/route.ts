import { NextResponse } from "next/server";
import { getFeed, isSheetsConfigured } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!isSheetsConfigured()) {
    return NextResponse.json({ feed: [], total: 0, demo: true });
  }
  try {
    const { feed, total } = await getFeed(15);
    return NextResponse.json({ feed, total });
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อ่านฟีดการโหวตไม่ได้", details },
      { status: 500 }
    );
  }
}
