/**
 * ทดสอบว่าการตัดโควตาที่นั่งทนต่อ race condition จริง
 *
 * จำลองสถานการณ์จริงตามข้อกำหนด E1: คนกดลงทะเบียนพร้อมกันจำนวนมาก
 * ในช่วงนาทีแรกที่เปิดรับ ระบบต้องไม่รับเกินโควตาแม้แต่ที่นั่งเดียว
 *
 * รันด้วย: npx tsx scripts/test-quota.ts
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventSessions, events, seatHolds } from "@/db/schema";
import { holdSeat, releaseAllExpiredHolds, releaseHold } from "@/lib/quota";

const QUOTA = 10;
const CONCURRENT = 60;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "❌"} ${label}: ได้ ${actual}${ok ? "" : ` (ต้องได้ ${expected})`}`);
}

async function main() {
  console.log("🧪 ทดสอบการตัดโควตาที่นั่ง\n");

  const [event] = await db.select().from(events).where(eq(events.slug, "tnn-event-2026"));
  if (!event) throw new Error("ไม่พบงานตัวอย่าง — รัน npm run db:seed ก่อน");

  const [session] = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id));
  if (!session) throw new Error("ไม่พบช่วงเวลา");

  // ตั้งค่าเริ่มต้นให้เหลือที่นั่งพอดี QUOTA ที่นั่ง
  await db.delete(seatHolds).where(eq(seatHolds.sessionId, session.id));
  await db
    .update(eventSessions)
    .set({ quota: QUOTA, reservedCount: 0 })
    .where(eq(eventSessions.id, session.id));

  // ---------- การทดสอบที่ 1: ยิงพร้อมกันต้องไม่เกินโควตา ----------
  console.log(`การทดสอบที่ 1 — ยิง ${CONCURRENT} คำขอพร้อมกัน ใส่ที่นั่ง ${QUOTA} ที่`);
  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, () =>
      holdSeat(db, { eventId: event.id, sessionId: session.id, holdMinutes: 15 }).catch(
        () => ({ ok: false as const, reason: "sold_out" as const, remaining: 0 }),
      ),
    ),
  );

  const granted = results.filter((r) => r.ok).length;
  const rejected = results.filter((r) => !r.ok).length;

  const [afterRace] = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.id, session.id));
  const [{ holdRows }] = await db
    .select({ holdRows: sql<number>`count(*)::int` })
    .from(seatHolds)
    .where(eq(seatHolds.sessionId, session.id));

  check("จองสำเร็จ", granted, QUOTA);
  check("ถูกปฏิเสธ", rejected, CONCURRENT - QUOTA);
  check("reservedCount ในฐานข้อมูล", afterRace?.reservedCount, QUOTA);
  check("จำนวนแถวใน seat_holds", holdRows, QUOTA);
  check("โทเคนไม่ซ้ำกัน", new Set(results.filter((r) => r.ok).map((r) => r.holdToken)).size, QUOTA);

  // ---------- การทดสอบที่ 2: ยกเลิกการจองแล้วที่นั่งต้องคืน ----------
  console.log("\nการทดสอบที่ 2 — ยกเลิกการจอง 3 ที่ ที่นั่งต้องคืนกลับ");
  const tokens = results.filter((r) => r.ok).map((r) => r.holdToken).slice(0, 3);
  for (const t of tokens) await releaseHold(db, t);

  const [afterRelease] = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.id, session.id));
  check("reservedCount หลังยกเลิก 3 ที่", afterRelease?.reservedCount, QUOTA - 3);

  // ---------- การทดสอบที่ 3: ที่นั่งหมดอายุต้องถูกคืนอัตโนมัติ ----------
  console.log("\nการทดสอบที่ 3 — ที่นั่งที่จองค้างหมดอายุ ต้องถูกคืนตอนมีคนขอจองใหม่");
  // ทำให้การจองที่เหลือทั้งหมดหมดอายุย้อนหลัง
  await db
    .update(seatHolds)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(seatHolds.sessionId, session.id));

  const retry = await holdSeat(db, {
    eventId: event.id,
    sessionId: session.id,
    holdMinutes: 15,
  });
  check("จองได้อีกครั้งหลังของเก่าหมดอายุ", retry.ok, true);

  const [afterExpiry] = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.id, session.id));
  check("reservedCount เหลือเฉพาะรายการใหม่", afterExpiry?.reservedCount, 1);

  // ---------- การทดสอบที่ 4: ปิดช่วงเวลาแล้วต้องจองไม่ได้ ----------
  console.log("\nการทดสอบที่ 4 — ปิดรับช่วงเวลาแล้วต้องจองไม่ได้");
  await db.update(eventSessions).set({ isClosed: true }).where(eq(eventSessions.id, session.id));
  const closed = await holdSeat(db, {
    eventId: event.id,
    sessionId: session.id,
    holdMinutes: 15,
  });
  check("ถูกปฏิเสธเพราะปิดรับ", closed.ok === false && closed.reason, "session_closed");

  // ---------- คืนค่าเดิม ----------
  await db.delete(seatHolds).where(eq(seatHolds.sessionId, session.id));
  await db
    .update(eventSessions)
    .set({ quota: 250, reservedCount: 0, isClosed: false })
    .where(eq(eventSessions.id, session.id));
  await releaseAllExpiredHolds(db);

  console.log(
    failures === 0
      ? "\n✅ ผ่านทุกข้อ — ระบบตัดโควตาทนต่อการกดพร้อมกันได้จริง"
      : `\n❌ ไม่ผ่าน ${failures} ข้อ`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("❌ ทดสอบล้มเหลว:", e);
  process.exit(1);
});
