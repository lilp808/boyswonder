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

// โปรไฟล์สมาชิกแบบเต็ม (ตัวจริงอยู่ในตาราง members บน Supabase)
export type Role = {
  name: string;
  color: string;
};

export type MemberProfile = {
  name: string;
  subtitle: string;
  avatar_url: string;
  bg_url: string;
  roles: Role[];
  sort_order: number;
  is_active: boolean;
  score: number;
};

export type SiteSettings = {
  site_name: string;
  site_tagline: string;
  vote_title: string;
  vote_subtitle: string;
  rule_threshold: string;
  rule_text: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "BOYS WONDER",
  site_tagline: "CONDUCT PROTOCOL",
  vote_title: "โหวตความประพฤติ",
  vote_subtitle: "ใครก็กดได้ กดได้เรื่อยๆ ไม่จำกัด",
  rule_threshold: "-10",
  rule_text:
    "ผู้ที่ได้แต้มต่ำกว่า -10 ในวันอาทิตย์ จะต้องเลี้ยงชานมไข่มุก หรือเป็นคนเปิดตี้เกมรอบดึกตามมติสภา Boys Wonder!",
};

export function isMember(name: string): name is MemberName {
  return (MEMBERS as readonly string[]).includes(name);
}

// อักษรย่ออวตาร + ฉายาประจำตัว (fallback ตอน demo — ตัวจริงอยู่ใน Supabase)
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

export function avatarInitial(name: string): string {
  return AVATAR[name] ?? name.charAt(0);
}
