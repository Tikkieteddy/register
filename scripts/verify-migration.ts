/**
 * ตรวจว่าฐานข้อมูลอัปเดตครบตามโค้ดล่าสุดแล้วหรือยัง
 *
 * รันด้วย: npm run db:verify
 *
 * ทำไมต้องมีสคริปต์นี้:
 *   คำสั่ง db:migrate พิมพ์ข้อความ NOTICE ออกมาเยอะจนบรรทัดสรุปกลืนหายไป
 *   และเคยเกิดกรณีที่ migrate "ดูเหมือนผ่าน" ทั้งที่ไฟล์ migration ยังไม่ถูกดึงลงเครื่อง
 *   สคริปต์นี้จึงไม่ดูข้อความบนจอ แต่ไปเปิดดูของจริงในฐานข้อมูลว่ามีครบหรือยัง
 *
 * ตอบเป็นภาษาไทยชัด ๆ ว่า "พร้อม deploy" หรือ "ยังไม่พร้อม ต้องทำอะไรต่อ"
 * ออกด้วยรหัส 1 ถ้ายังไม่พร้อม
 */
import "../src/lib/load-env";
import { readdirSync } from "node:fs";
import { sql } from "drizzle-orm";

/**
 * รายการสิ่งที่ต้องมีในฐานข้อมูล เรียงตาม migration ที่เพิ่มมันเข้ามา
 *
 * เพิ่มรายการใหม่ทุกครั้งที่เขียน migration ที่เปลี่ยนโครงสร้างสำคัญ
 * เพื่อให้ปัญหา "ลืมรัน migrate บนเครื่องจริง" ถูกจับได้ก่อนขึ้นระบบ
 */
type Requirement = {
  migration: string;
  what: string;
  check: (db: Awaited<ReturnType<typeof getDb>>) => Promise<boolean>;
};

async function getDb() {
  const { db } = await import("../src/db");
  return db;
}

const REQUIREMENTS: Requirement[] = [
  {
    migration: "0001_add_rate_limits",
    what: "ตารางนับจำนวนครั้ง (กันคนยิงถล่ม)",
    check: async (db) => {
      const rows = await db.execute<{ n: number }>(sql`
        select count(*)::int as n from information_schema.tables
        where table_schema = 'public' and table_name = 'rate_limits'
      `);
      return (rows[0]?.n ?? 0) > 0;
    },
  },
  {
    migration: "0002_add_data_retention",
    what: "ช่องกำหนดระยะเวลาเก็บข้อมูล (PDPA)",
    check: async (db) => {
      const rows = await db.execute<{ n: number }>(sql`
        select count(*)::int as n from information_schema.columns
        where table_name = 'events' and column_name = 'data_retention_days'
      `);
      return (rows[0]?.n ?? 0) > 0;
    },
  },
  {
    migration: "0003_cancelled_can_register_again",
    what: "ยกเลิกแล้วกลับมาลงทะเบียนใหม่ได้",
    check: async (db) => {
      // ต้องเป็น index แบบมีเงื่อนไข (partial) ที่ไม่นับแถวซึ่งถูกยกเลิกแล้ว
      const rows = await db.execute<{ def: string }>(sql`
        select indexdef as def from pg_indexes
        where tablename = 'registrations' and indexname = 'registrations_event_email_uq'
      `);
      return (rows[0]?.def ?? "").includes("cancelled");
    },
  },
];

async function main() {
  console.log("\n🔍 ตรวจว่าฐานข้อมูลอัปเดตครบตามโค้ดล่าสุดหรือยัง\n");

  // ① ไฟล์ migration อยู่ในเครื่องครบหรือไม่ — จับกรณี git pull ไม่สำเร็จ
  const files = readdirSync(new URL("../drizzle", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  console.log(`ไฟล์ migration ในเครื่อง: ${files.length} ไฟล์`);
  for (const name of files) console.log(`   · ${name}`);

  const missingFiles = REQUIREMENTS.filter(
    (req) => !files.some((name) => name.startsWith(req.migration.slice(0, 4))),
  );

  if (missingFiles.length > 0) {
    console.log("\n❌ ไฟล์ migration ในเครื่องไม่ครบ");
    console.log("   แปลว่าโค้ดล่าสุดยังไม่ถูกดึงลงเครื่อง");
    console.log("   ให้รัน: git pull origin claude/event-registration-step-0-i9ulcz");
    console.log("   แล้วค่อยรัน npm run db:migrate ใหม่\n");
    process.exit(1);
  }

  // ② ของจริงในฐานข้อมูลมีครบหรือยัง
  console.log("\nตรวจของจริงในฐานข้อมูล:");
  const db = await getDb();
  const missing: Requirement[] = [];

  for (const req of REQUIREMENTS) {
    let ok = false;
    try {
      ok = await req.check(db);
    } catch (error) {
      console.log(`   ❌ ${req.what} — ตรวจไม่ได้: ${(error as Error).message}`);
      missing.push(req);
      continue;
    }
    console.log(`   ${ok ? "✅" : "❌"} ${req.what}`);
    if (!ok) missing.push(req);
  }

  if (missing.length > 0) {
    console.log("\n❌ ฐานข้อมูลยังอัปเดตไม่ครบ");
    console.log("   ยังขาด:");
    for (const req of missing) console.log(`     · ${req.what}  (${req.migration})`);
    console.log("\n   ให้รัน: npm run db:migrate");
    console.log("   แล้วรัน npm run db:verify ซ้ำอีกครั้ง");
    console.log("   ⚠️ ห้าม deploy จนกว่าคำสั่งนี้จะขึ้นว่าพร้อม\n");
    process.exit(1);
  }

  console.log("\n✅ ฐานข้อมูลอัปเดตครบแล้ว พร้อม deploy\n");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("\n❌ ต่อฐานข้อมูลไม่ได้");
  console.error(`   ${error instanceof Error ? error.message : String(error)}`);
  console.error("\n   ตรวจว่า DATABASE_URL ใน .env.local ถูกต้องหรือไม่");
  console.error("   ถ้ายังไม่หาย ให้รัน npm run check:deploy เพื่อดูสาเหตุแบบละเอียด\n");
  process.exit(1);
});
