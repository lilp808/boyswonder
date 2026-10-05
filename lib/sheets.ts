import { MEMBERS, type ScoreEntry } from "./members";

function getConfig() {
  return {
    baseUrl: process.env.GAS_API_URL,
  };
}

export function isSheetsConfigured() {
  return Boolean(getConfig().baseUrl);
}

type GasResponse = {
  scores?: ScoreEntry[];
  error?: string;
};

async function callGas(params: Record<string, string>): Promise<ScoreEntry[]> {
  const { baseUrl } = getConfig();
  if (!baseUrl) {
    throw new Error("ยังไม่ได้ตั้งค่า GAS_API_URL");
  }

  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    throw new Error("ติดต่อ Apps Script ไม่ได้");
  }

  let data: GasResponse;
  try {
    data = (await res.json()) as GasResponse;
  } catch {
    throw new Error("Apps Script ตอบกลับไม่ใช่ JSON (เช็คว่าใช้ URL /exec)");
  }

  if (!res.ok || data.error || !Array.isArray(data.scores)) {
    throw new Error(data.error ?? `Apps Script ตอบ ${res.status}`);
  }

  // จัดลำดับตามสมาชิกคงที่เสมอ ตัวไหนไม่มีให้เป็น 0
  const map = new Map<string, number>();
  for (const s of data.scores) {
    if (s && typeof s.name === "string") {
      const n = Number(s.score) || 0;
      map.set(s.name, n);
    }
  }
  return MEMBERS.map((name) => ({ name, score: map.get(name) ?? 0 }));
}

export async function getScores(): Promise<ScoreEntry[]> {
  return callGas({ action: "scores" });
}

export async function voteAndGetScores(
  name: string,
  delta: 1 | -1
): Promise<ScoreEntry[]> {
  return callGas({ action: "vote", name, delta: String(delta) });
}
