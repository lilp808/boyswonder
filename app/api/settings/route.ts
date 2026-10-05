import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@/lib/members";
import { getSettings, isSheetsConfigured } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!isSheetsConfigured()) {
    return NextResponse.json({ settings: DEFAULT_SETTINGS, demo: true });
  }
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    console.error(e);
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "อ่านตั้งค่าเว็บไม่ได้", details },
      { status: 500 }
    );
  }
}
