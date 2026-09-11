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

/**
 * สร้างผู้ลงทะเบียนสำหรับเทสต์ พร้อมตั๋วและช่วงเวลาที่เลือกไว้
 *
 * ⚠️ เทสต์ที่ไปหยิบข้อมูลตัวอย่างมาใช้เป็นสาเหตุหลักของ "เทสต์ล้มแบบไม่มีเหตุผล"
 *    เช่น เทสต์เช็คอินที่ค้นชื่อแล้วกดคนแรกในผลลัพธ์ — พอรันซ้ำหรือรันหลังเทสต์อื่น
 *    คนแรกคนนั้นเช็คอินไปแล้ว เทสต์จึงได้จอเหลืองแทนจอเขียวแล้วฟ้องว่าไม่ผ่าน
 *    ทั้งที่ระบบทำงานถูกต้อง
 *
 *    เทสต์จึงต้องสร้างคนของตัวเองที่ชื่อไม่ซ้ำกับใคร แล้วลบทิ้งเมื่อจบเสมอ
 */
export async function createTestRegistrant(sql, { eventSlug, firstName, lastName, email }) {
  const [event] = await sql`select id from events where slug = ${eventSlug}`;
  if (!event) throw new Error(`ไม่พบงาน ${eventSlug}`);

  const code = `T${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const [reg] = await sql`
    insert into registrations
      (event_id, registration_code, first_name, last_name, email, phone, status, source)
    values
      (${event.id}, ${code}, ${firstName}, ${lastName},
       ${email ?? `${code.toLowerCase()}@test.local`}, '0800000000', 'confirmed', 'admin_manual')
    returning id
  `;

  // ผูกทุกช่วงเวลาของงาน เพื่อให้เช็คอินได้ไม่ว่าหน้าจอจะเลือกช่วงไหนให้
  const sessions = await sql`
    select id from event_sessions where event_id = ${event.id} order by sort_order
  `;
  for (const s of sessions) {
    await sql`
      insert into registration_sessions (registration_id, session_id)
      values (${reg.id}, ${s.id})
    `;
  }

  const [ticket] = await sql`
    insert into tickets
      (registration_id, ticket_code, holder_first_name, holder_last_name, holder_email)
    values
      (${reg.id}, ${code + "-T"}, ${firstName}, ${lastName},
       ${email ?? `${code.toLowerCase()}@test.local`})
    returning qr_token
  `;

  return { registrationId: reg.id, registrationCode: code, qrToken: ticket.qr_token };
}

/** ลบผู้ลงทะเบียนที่เทสต์สร้างขึ้น (ตารางลูกตั้ง cascade ไว้แล้ว) */
export async function deleteTestRegistrants(sql, { firstName }) {
  const deleted = await sql`
    delete from registrations where first_name = ${firstName} returning registration_code
  `;
  return deleted.length;
}

/**
 * ลบภาพที่เทสต์อัปโหลดไว้ ทั้งแถวในฐานข้อมูลและไฟล์ในเครื่อง
 *
 * ⚠️ เทสต์หน้าจัดการภาพเดิมไม่ลบของตัวเองเลย ไฟล์จึงพอกขึ้นทุกรอบ
 *    แล้วเทสต์ที่หยิบ "ภาพแรกที่เจอบนหน้า" ไปตรวจ ก็ไปเจอไฟล์ค้างจากรอบก่อน
 *    แทนไฟล์ที่เพิ่งอัปโหลด แล้วฟ้องว่าไม่ผ่านทั้งที่ระบบทำงานถูก
 */
export async function deleteTestMedia(sql, { eventSlug }) {
  const { rm } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const rows = await sql`
    delete from media_assets
    where event_id in (select id from events where slug = ${eventSlug})
    returning original_url
  `;

  // ลบไฟล์จริงในโฟลเดอร์ที่เก็บตอนพัฒนาในเครื่องด้วย ไม่ให้ค้างสะสม
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await rm(uploadsDir, { recursive: true, force: true }).catch(() => {});

  return rows.length;
}
