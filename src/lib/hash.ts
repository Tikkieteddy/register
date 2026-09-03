import { createHash } from "node:crypto";
import { getServerEnv } from "./env";

/**
 * แฮชค่าที่ระบุตัวบุคคลได้ก่อนเก็บลงฐานข้อมูล
 *
 * ⚠️ ข้อกำหนด PDPA: ห้ามเก็บ IP ดิบ — ทุกที่ที่มีฟิลด์ ipHash หรือ visitorHash
 * ต้องผ่านฟังก์ชันนี้เสมอ ห้ามเขียนค่าดิบลงไปตรง ๆ
 */
export function hashIdentifier(value: string): string {
  const salt = getServerEnv().HASH_SALT ?? "";
  if (!salt) {
    throw new Error("ยังไม่ได้ตั้งค่า HASH_SALT — จำเป็นต่อการแฮช IP ตามข้อกำหนด PDPA");
  }
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}
