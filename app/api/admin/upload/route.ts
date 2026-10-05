import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const password = String(form.get("password") ?? req.headers.get("x-admin-password") ?? "");
    requireAdmin(password);

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("ยังไม่ได้ตั้งค่า Supabase บน server");
    const supa = createClient(url, key, { auth: { persistSession: false } });

    const file = form.get("file");
    if (!(file instanceof Blob)) throw new Error("ต้องแนบไฟล์รูป (file)");
    const type = (file as File).type || "image/jpeg";
    if (!type.startsWith("image/")) throw new Error("ไฟล์ต้องเป็นรูปภาพเท่านั้น");
    if (file.size > MAX_BYTES) throw new Error("รูปใหญ่เกิน 4MB");
    if (file.size === 0) throw new Error("ไฟล์ว่างเปล่า");

    const orig = ((file as File).name || "avatar").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const ext = orig.includes(".") ? orig.slice(orig.lastIndexOf(".")) : ".jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supa.storage.from("avatars").upload(path, buf, {
      contentType: type,
      upsert: false,
    });
    if (upErr) throw new Error("อัปโหลดไม่ได้: " + upErr.message);

    const { data } = supa.storage.from("avatars").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    const status = /รหัสผ่าน/.test(details) ? 401 : 400;
    return NextResponse.json({ error: "อัปโหลดรูปไม่ได้", details }, { status });
  }
}
