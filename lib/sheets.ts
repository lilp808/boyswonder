import { google } from "googleapis";
import { MEMBERS, type ScoreEntry } from "./members";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getEnv() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return { sheetId, clientEmail, privateKey };
}

export function isSheetsConfigured() {
  const { sheetId, clientEmail, privateKey } = getEnv();
  return Boolean(sheetId && clientEmail && privateKey);
}

function getClient() {
  const { clientEmail, privateKey } = getEnv();
  if (!clientEmail || !privateKey) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });
}

export async function getScores(): Promise<ScoreEntry[]> {
  const { sheetId } = getEnv();
  if (!sheetId) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SHEET_ID");

  const auth = getClient();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Scores!A2:B8",
  });

  const rows = res.data.values ?? [];
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = String(row[0] ?? "").trim();
    const score = Number(row[1] ?? 0);
    if (name) map.set(name, Number.isFinite(score) ? score : 0);
  }

  // คืนตามลำดับสมาชิกคงที่เสมอ ตัวไหนไม่มีในชีตให้เป็น 0
  return MEMBERS.map((name) => ({
    name,
    score: map.get(name) ?? 0,
  }));
}

export async function voteAndGetScores(
  name: string,
  delta: 1 | -1
): Promise<ScoreEntry[]> {
  const { sheetId } = getEnv();
  if (!sheetId) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SHEET_ID");

  const auth = getClient();
  const sheets = google.sheets({ version: "v4", auth });

  // 1) เก็บ log ทุกโหวต (append-only กันโหวตหาย + ตรวจสอบย้อนหลังได้)
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Log!A:C",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString(), name, delta]],
    },
  });

  // 2) อ่านคะแนนปัจจุบัน
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Scores!A2:B8",
  });
  const rows = res.data.values ?? [];

  let rowIndex = -1;
  let current = 0;
  rows.forEach((row, i) => {
    if (String(row[0] ?? "").trim() === name) {
      rowIndex = i;
      current = Number(row[1] ?? 0) || 0;
    }
  });

  const next = current + delta;

  if (rowIndex >= 0) {
    // แถวที่ 2 ในชีต = index 0 → ต้อง +2
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Scores!B${rowIndex + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[next]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Scores!A:B",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[name, next]] },
    });
  }

  return getScores();
}
