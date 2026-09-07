/**
 * ล้างข้อมูลผู้ลงทะเบียนทั้งหมดออกจากฐานข้อมูลพัฒนา
 *
 * ⚠️ สำหรับเครื่องพัฒนาเท่านั้น — ลบข้อมูลผู้ลงทะเบียนทุกคนอย่างถาวร
 *    ปฏิเสธการทำงานถ้า NODE_ENV = production
 *
 * ใช้ก่อนรันชุดทดสอบทุกครั้ง เพราะการทดสอบเช็คอินจะทิ้งข้อมูลไว้
 * ทำให้รอบถัดไปขึ้น "เช็คอินไปแล้ว" ซึ่งถูกต้อง แต่ทำให้เข้าใจผิดว่าระบบพัง
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";

if (process.env.NODE_ENV === "production") {
  throw new Error("ห้ามล้างข้อมูลกับฐานข้อมูลจริง");
}

async function main() {
  await db.execute(sql`
    truncate table check_ins, badge_prints, tickets, registration_answers,
                   registration_sessions, consents, email_logs, seat_holds,
                   calendar_syncs, link_events, registrations
    restart identity cascade
  `);
  await db.execute(sql`update event_sessions set reserved_count = 0, checked_in_count = 0`);
  await db.execute(sql`update share_links set click_count = 0, unique_count = 0, conversion_count = 0`);
  console.log("✅ ล้างข้อมูลผู้ลงทะเบียนและตัวนับที่นั่งเรียบร้อย");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
