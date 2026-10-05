import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MEMBERS, isMember, type ScoreEntry } from "./members";

export type FeedEntry = {
  t: string;
  name: string;
  delta: number;
};

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export function isSheetsConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function normalize(rows: { name: string; score: number | null }[]): ScoreEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r && typeof r.name === "string") map.set(r.name, r.score ?? 0);
  }
  return MEMBERS.map((name) => ({ name, score: map.get(name) ?? 0 }));
}

export async function getScores(): Promise<ScoreEntry[]> {
  const { data, error } = await db().from("scores").select("name,score");
  if (error) throw new Error("อ่านคะแนนจาก Supabase ไม่ได้: " + error.message);
  return normalize(data ?? []);
}

export async function voteAndGetScores(
  name: string,
  delta: 1 | -1
): Promise<ScoreEntry[]> {
  if (!isMember(name)) throw new Error("ชื่อไม่ถูกต้อง");
  const { data, error } = await db().rpc("vote_member", {
    p_name: name,
    p_delta: delta,
  });
  if (error) throw new Error("บันทึกโหวตลง Supabase ไม่ได้: " + error.message);
  return normalize((data ?? []) as { name: string; score: number | null }[]);
}

export async function getFeed(limit = 15): Promise<{
  feed: FeedEntry[];
  total: number;
}> {
  const c = db();
  const [{ data, error }, { count }] = await Promise.all([
    c
      .from("votes_log")
      .select("created_at,name,delta")
      .order("created_at", { ascending: false })
      .limit(limit),
    c.from("votes_log").select("id", { count: "exact", head: true }),
  ]);
  if (error) throw new Error("อ่านฟีดจาก Supabase ไม่ได้: " + error.message);
  return {
    feed: (data ?? []).map((r) => ({
      t: r.created_at as string,
      name: r.name as string,
      delta: r.delta as number,
    })),
    total: count ?? 0,
  };
}
