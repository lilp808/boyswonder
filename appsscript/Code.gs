/***************************************************************
 * Boys Wonder — คะแนนความประพฤติ API
 * วิธีติดตั้ง:
 *  1) เปิด Google Sheet ไฟล์คะแนน → Extensions → Apps Script
 *  2) ลบโค้ดเดิม วางไฟล์นี้ทั้งหมด → กด Save
 *  3) รันฟังก์ชัน debugScores() 1 ครั้งเพื่อกด Allow (authorize)
 *  4) Deploy → New deployment → Web app → Execute as: Me / Access: Anyone
 *  5) เอา URL ที่ลงท้าย /exec ไปใส่ Vercel Env ชื่อ GAS_API_URL
 *     (แก้โค้ดทีหลังต้อง Deploy → Manage deployments → New version ทุกครั้ง)
 *
 * API (GET อย่างเดียว หลบปัญหา redirect ของ Apps Script, ไม่ต้องใช้ key):
 *  ?action=scores
 *    → {"scores":[{"name":"พี่แม้ก","score":0}, ...]}
 *  ?action=vote&name=พี่แม้ก&delta=1
 *    → {"scores":[...]} (คะแนนหลังโหวต)
 *
 * กติกา: +1/-1 ไม่จำกัด ติดลบได้ ไม่มีรีเซ็ต
 ***************************************************************/

var MEMBERS = [
  'พี่แม้ก',
  'น้องซี',
  'น้องไอซ์',
  'น้องเข้ม',
  'จารมอส',
  'ปอแซก',
  'พี่บาม',
];

function doGet(e) {
  try {
    var action = String((e.parameter && e.parameter.action) || 'scores');
    if (action === 'vote') {
      return json_({ scores: vote_(e.parameter) });
    }
    return json_({ scores: getScores_() });
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  }
}

/** ฟังก์ชันช่วยเทส: รันใน editor เพื่อ authorize + ดูคะแนนใน Logs */
function debugScores() {
  Logger.log(JSON.stringify(getScores_()));
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getScores_() {
  var sheet = ss_().getSheetByName('Scores');
  if (!sheet) throw new Error('ไม่พบ tab Scores');
  var rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 2).getValues();
  var map = {};
  rows.forEach(function (r) {
    var name = String(r[0] || '').trim();
    if (name) map[name] = Number(r[1] || 0) || 0;
  });
  return MEMBERS.map(function (name) {
    return { name: name, score: name in map ? map[name] : 0 };
  });
}

function vote_(params) {
  var name = String((params && params.name) || '').trim();
  var delta = Number(params && params.delta);
  if (MEMBERS.indexOf(name) === -1) throw new Error('ชื่อไม่ถูกต้อง');
  if (delta !== 1 && delta !== -1) throw new Error('delta ต้องเป็น 1 หรือ -1');

  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // กันกดพร้อมกันแล้วคะแนนหาย
  try {
    var s = ss_();

    var log = s.getSheetByName('Log');
    if (!log) throw new Error('ไม่พบ tab Log');
    log.appendRow([new Date(), name, delta]);

    var sheet = s.getSheetByName('Scores');
    if (!sheet) throw new Error('ไม่พบ tab Scores');
    var lastRow = sheet.getLastRow();
    var foundRow = -1;
    var current = 0;
    if (lastRow >= 2) {
      var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0] || '').trim() === name) {
          foundRow = i + 2; // แถวจริงในชีต (เริ่มแถว 2)
          current = Number(rows[i][1] || 0) || 0;
          break;
        }
      }
    }
    if (foundRow > 0) {
      sheet.getRange(foundRow, 2).setValue(current + delta);
    } else {
      sheet.appendRow([name, delta]);
    }

    SpreadsheetApp.flush();
    return getScores_();
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
