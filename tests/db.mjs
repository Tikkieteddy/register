/**
 * ตัวช่วยต่อฐานข้อมูลสำหรับเทสต์ — ใช้เก็บกวาดข้อมูลที่เทสต์สร้างขึ้น
 *
 * ⚠️ เทสต์ที่สร้างข้อมูลค้างไว้ทำให้เทสต์ตัวอื่นล้มโดยไม่มีสาเหตุที่ชัดเจน
 *    เช่น งานทดสอบที่ตั้งวันไว้ปีหน้าจะกลายเป็น "งานล่าสุด" ที่หลังบ้านเปิดให้เอง
 *    เทสต์หลังบ้านตัวอื่นจึงไปเจองานผิดตัวแล้วหาข้อมูลที่คาดไว้ไม่พบ
 *    ทุกเทสต์ที่เขียนข้อมูลลงฐานข้อมูลจึงต้องลบของตัวเองทิ้งเสมอ
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // เทสต์รันนอก Next.js จึงไม่มีใครโหลด .env.local ให้ ต้องอ่านเอง
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("ไม่พบ DATABASE_URL — ตั้งค่าใน .env.local หรือส่งผ่าน environment variable");
}

export function connect() {
  return postgres(readDatabaseUrl(), { max: 1, prepare: false, onnotice: () => {} });
}

/**
 * ลบงานทดสอบทิ้งตาม slug ที่ขึ้นต้นด้วยคำนำหน้าที่กำหนด
 *
 * event_sessions · registrations และตารางลูกอื่นตั้ง on delete cascade ไว้แล้ว
 * จึงหายตามไปเองโดยไม่ต้องไล่ลบทีละตาราง
 */
export async function deleteEventsByPrefix(prefix) {
  const sql = connect();
  try {
    const deleted = await sql`delete from events where slug like ${prefix + "%"} returning slug`;
    return deleted.map((row) => row.slug);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
