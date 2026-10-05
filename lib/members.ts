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
