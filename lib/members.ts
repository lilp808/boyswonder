export const MEMBERS = [
  "พี่แม้ก",
  "น้องซี",
  "น้องไอซ์",
  "น้องเข้ม",
  "จารมอส",
  "ปอแซก",
  "พี่บาม",
] as const;

export type MemberName = (typeof MEMBERS)[number];

export type ScoreEntry = {
  name: string;
  score: number;
};

export function isMember(name: string): name is MemberName {
  return (MEMBERS as readonly string[]).includes(name);
}

// อักษรย่ออวตาร + ฉายาประจำตัว (ไว้โชว์ในการ์ด)
export const AVATAR: Record<string, string> = {
  "พี่แม้ก": "ม",
  "น้องซี": "ซ",
  "น้องไอซ์": "อ",
  "น้องเข้ม": "ข",
  "จารมอส": "จ",
  "ปอแซก": "ป",
  "พี่บาม": "บ",
};

export const SUBTITLE: Record<string, string> = {
  "พี่แม้ก": "จอมหัวร้อนประจำตึก",
  "น้องซี": "สายซัพพอร์ต",
  "น้องไอซ์": "แนวหน้าสายสับ",
  "น้องเข้ม": "เงียบแต่เฉียบคม",
  "จารมอส": "ปรมาจารย์แผนที่",
  "ปอแซก": "ตัวฮาประจำวอยซ์",
  "พี่บาม": "โปรเพลเยอร์ประจำทีม",
};
