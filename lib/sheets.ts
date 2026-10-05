import { google } from "googleapis";
import { MEMBERS, type ScoreEntry } from "./members";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getEnv() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  // วิธีที่ 1: Service Account
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  // วิธีที่ 2: OAuth Client (client_id + client_secret + refresh_token)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  return { sheetId, clientEmail, privateKey, clientId, clientSecret, refreshToken };
}

export function isSheetsConfigured() {
  const { sheetId, clientEmail, privateKey, clientId, clientSecret, refreshToken } =
    getEnv();
  const serviceAccount = Boolean(clientEmail && privateKey);
  const oauth = Boolean(clientId && clientSecret && refreshToken);
  return Boolean(sheetId && (serviceAccount || oauth));
}

function getClient() {
  const { clientEmail, privateKey, clientId, clientSecret, refreshToken } = getEnv();
  if (clientEmail && privateKey) {
    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: SCOPES,
    });
  }
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }
  throw new Error(
    "ยังไม่ได้ตั้งค่าการยืนยันตัวตน — ใช้ Service Account หรือ OAuth Client (CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN)"
  );
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
