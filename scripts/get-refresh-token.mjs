// ขอ Google Refresh Token ครั้งเดียวด้วย OAuth Client ID + Secret
// วิธีใช้: GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npm run sheets:auth
// เงื่อนไข: OAuth Client ต้องเป็นชนิด "Desktop app" (loopback redirect ใช้ได้เลย ไม่ต้องลงทะเบียน URL)
import http from "node:http";
import { google } from "googleapis";

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "ต้องตั้งค่า GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET ก่อน (เช่น GOOGLE_CLIENT_ID=xxx npm run sheets:auth)"
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? "", REDIRECT_URI);
    if (u.pathname !== "/oauth2callback") {
      res.writeHead(404).end("Not found");
      return;
    }
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error");
    if (err || !code) {
      res.writeHead(400).end(`Authorize ไม่สำเร็จ: ${err ?? "no code"}`);
      server.close();
      process.exit(1);
    }
    const { tokens } = await oauth2.getToken(code);
    res
      .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
      .end("สำเร็จ! กลับไปดูค่าใน terminal ได้เลย");
    console.log("\n✅ สำเร็จ! เอาค่านี้ไปใส่ Vercel Env:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    if (!tokens.refresh_token) {
      console.log(
        "⚠️ ไม่ได้ refresh_token กลับมา — ลองไป revoke access ที่ https://myaccount.google.com/permissions แล้วรันใหม่"
      );
    }
    server.close();
  } catch (e) {
    console.error("แลก code ไม่สำเร็จ:", e instanceof Error ? e.message : e);
    try {
      res.writeHead(500).end("แลก code ไม่สำเร็จ ดูใน terminal");
    } catch {}
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("เปิดลิงก์นี้ในเบราว์เซอร์ แล้วกด Allow ด้วย Google account เจ้าของ Sheet:\n");
  console.log(url + "\n");
  console.log(`(รอ callback ที่ ${REDIRECT_URI} ...)`);
});
