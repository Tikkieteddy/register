/**
 * ทดสอบโหลด — จำลองคน 300 คนแย่งกดจองที่นั่งพร้อมกัน (ข้อกำหนด E1)
 *
 * รันด้วย: npm run test:load
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 และติดตั้ง k6
 *
 * สคริปต์นี้ทำ 3 อย่างให้อัตโนมัติ เพราะถ้าให้คนทำเองจะพลาดง่ายมาก:
 *   ① หารหัสของคำสั่งจองที่นั่ง (เปลี่ยนทุกครั้งที่ build ใหม่)
 *   ② ตั้งที่นั่งให้เหลือตามจำนวนที่ต้องการทดสอบ และล้างตัวนับเดิม
 *   ③ ตรวจผลที่ฐานข้อมูลว่ารับเกินโควตาหรือไม่ ซึ่งเป็นคำถามที่แท้จริงของเทสต์นี้
 *
 * ⚠️ คืนค่าที่นั่งกลับให้เหมือนเดิมเมื่อจบเสมอ ไม่ทิ้งฐานข้อมูลไว้ในสภาพแปลก ๆ
 */
import "../src/lib/load-env";
import { execFileSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** จำนวนที่นั่งที่เปิดให้แย่ง — น้อยกว่าจำนวนคนมาก เพื่อบีบให้เกิดการแย่งกันจริง */
const SEATS = 100;
const USERS = 300;
const BASE = process.env.BASE_URL ?? "http://localhost:3100";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ห้ามรันทดสอบโหลดกับฐานข้อมูลจริง");
  }

  const rows = await db.execute<{ id: string; name_th: string; quota: number }>(sql`
    select s.id, s.name_th, s.quota
    from event_sessions s
    join events e on e.id = s.event_id
    where e.status = 'published'
    order by s.sort_order
    limit 1
  `);
  const target = rows[0];
  if (!target) throw new Error("ไม่พบช่วงเวลาของงานที่เผยแพร่แล้ว");

  console.log(`\n🎯 ทดสอบกับช่วงเวลา "${target.name_th}" (ที่นั่งทั้งหมด ${target.quota})`);
  console.log(`   จำลองคน ${USERS} คนแย่งที่นั่ง ${SEATS} ที่พร้อมกัน\n`);

  /**
   * ① เตรียมที่นั่งก่อนเป็นอันดับแรก
   *
   * ⚠️ ต้องทำก่อนหารหัสคำสั่ง ห้ามสลับลำดับ
   *    เพราะการหารหัสต้องเปิดหน้าฟอร์มจริงแล้วกดเลือกช่วงเวลา
   *    ถ้าที่นั่งเต็มอยู่ ช่องเลือกจะถูกปิดไว้และกดไม่ได้ ทำให้หารหัสไม่สำเร็จ
   */
  const before = await db.execute<{ reserved_count: number }>(sql`
    select reserved_count from event_sessions where id = ${target.id}
  `);
  const originalReserved = before[0]?.reserved_count ?? 0;

  await db.execute(sql`delete from seat_holds where session_id = ${target.id}`);
  await db.execute(sql`delete from rate_limits`);
  await db.execute(sql`
    update event_sessions set reserved_count = quota - ${SEATS} where id = ${target.id}
  `);
  console.log(`① ตั้งที่นั่งให้เหลือ ${SEATS} ที่พอดี`);

  // ② หารหัสคำสั่งจองที่นั่ง โดยเปิดหน้าฟอร์มแล้วดักดูว่าเบราว์เซอร์ส่งอะไร
  console.log("② หารหัสคำสั่งจองที่นั่ง...");
  const actionId = execFileSync(
    "node",
    ["scripts/find-action-id.mjs"],
    { encoding: "utf8", env: { ...process.env, BASE_URL: BASE } },
  ).trim();
  if (!/^[0-9a-f]{20,}$/.test(actionId)) {
    throw new Error(`หารหัสคำสั่งไม่สำเร็จ ได้ค่า: ${actionId}`);
  }
  console.log(`   ได้รหัส ${actionId.slice(0, 12)}…`);

  /**
   * การหารหัสเมื่อกี้ใช้ที่นั่งไป 1 ที่จริง ๆ (เพราะกดเลือกจริง)
   * ต้องคืนกลับก่อน ไม่งั้นจำนวนที่เปิดให้แย่งจะไม่ตรงกับที่ตั้งใจ
   */
  await db.execute(sql`delete from seat_holds where session_id = ${target.id}`);
  await db.execute(sql`delete from rate_limits`);
  await db.execute(sql`
    update event_sessions set reserved_count = quota - ${SEATS} where id = ${target.id}
  `);
  console.log(`   คืนที่นั่งที่ใช้ตอนหารหัส — เหลือ ${SEATS} ที่พอดี\n`);

  // ③ ยิงจริง
  try {
    execFileSync("k6", ["run", "--no-usage-report", "tests/load/hold-seat.js"], {
      stdio: "inherit",
      env: { ...process.env, BASE_URL: BASE, SESSION_ID: target.id, ACTION_ID: actionId },
    });
  } catch {
    console.error("\n❌ k6 รายงานว่าไม่ผ่านเกณฑ์ ดูรายละเอียดด้านบน");
  }

  // ④ คำถามที่แท้จริง: รับเกินโควตาไหม
  const after = await db.execute<{ quota: number; reserved_count: number; holds: number }>(sql`
    select s.quota, s.reserved_count,
           (select count(*)::int from seat_holds h where h.session_id = s.id) as holds
    from event_sessions s where s.id = ${target.id}
  `);
  const result = after[0];
  if (!result) throw new Error("อ่านผลจากฐานข้อมูลไม่สำเร็จ");

  console.log("\n─────────── ผลที่ฐานข้อมูลจริง ───────────");
  console.log(`ที่นั่งทั้งหมด       : ${result.quota}`);
  console.log(`ถูกจองไปแล้ว        : ${result.reserved_count}`);
  console.log(`ใบจองในตาราง        : ${result.holds}`);

  const overbooked = result.reserved_count > result.quota;
  const exact = result.holds === SEATS;

  console.log(
    overbooked
      ? `\n❌ รับเกินโควตา ${result.reserved_count - result.quota} ที่ — ระบบตัดโควตาผิดพลาด`
      : "\n✅ ไม่รับเกินโควตาแม้แต่ที่เดียว",
  );
  console.log(
    exact
      ? `✅ จองได้ ${result.holds} ที่พอดีตามจำนวนที่เปิดให้ ไม่ขาดไม่เกิน`
      : `⚠️ จองได้ ${result.holds} ที่ จากที่เปิดให้ ${SEATS} ที่`,
  );

  // ⑤ คืนสภาพฐานข้อมูล
  await db.execute(sql`delete from seat_holds where session_id = ${target.id}`);
  await db.execute(sql`delete from rate_limits`);
  await db.execute(sql`
    update event_sessions set reserved_count = ${originalReserved} where id = ${target.id}
  `);
  console.log("\n🧹 คืนค่าที่นั่งกลับเป็นเหมือนก่อนทดสอบแล้ว\n");

  process.exit(overbooked ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("\n❌ ทดสอบโหลดล้มเหลว:", error instanceof Error ? error.message : error);
  process.exit(1);
});
