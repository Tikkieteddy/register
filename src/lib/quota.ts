import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { eventSessions, seatHolds } from "@/db/schema";

/**
 * ตัดโควตาที่นั่ง — จุดที่สำคัญที่สุดของทั้งระบบ
 *
 * ปัญหาที่ต้องกัน: ตอนเปิดรับลงทะเบียนจะมีคนกดพร้อมกัน 100–300 คนใน 5–10 นาทีแรก
 * (ข้อกำหนด E1) ถ้าอ่านค่า reservedCount มาบวกแล้วเขียนกลับแบบธรรมดา
 * สองคำขอที่มาพร้อมกันจะอ่านค่าเดิมค่าเดียวกันแล้วเขียนทับกัน = รับเกินโควตา
 *
 * วิธีแก้: ทำทั้งหมดใน transaction เดียว และล็อกแถวช่วงเวลาด้วย SELECT ... FOR UPDATE
 * คำขอที่สองจะรอจนคำขอแรก commit เสร็จ แล้วค่อยอ่านค่าที่อัปเดตแล้ว
 *
 * ⚠️ ห้ามแก้ให้เป็นการอ่านมาบวกแล้วเขียนกลับนอก transaction เด็ดขาด
 */

export type SeatHoldResult =
  | { ok: true; holdToken: string; expiresAt: Date; remaining: number }
  | {
      ok: false;
      reason: "session_not_found" | "session_closed" | "sold_out";
      remaining: number;
    };

/**
 * คืนที่นั่งที่จองค้างเกินเวลาของช่วงเวลาหนึ่ง
 *
 * เรียกจากภายใน transaction ที่ล็อกแถว eventSessions ไว้แล้วเท่านั้น
 * คืนค่าเป็นจำนวนที่นั่งที่ปล่อยกลับเข้าระบบ
 */
async function releaseExpiredHoldsForSession(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  sessionId: string,
): Promise<number> {
  const released = await tx
    .delete(seatHolds)
    .where(
      and(
        eq(seatHolds.sessionId, sessionId),
        lt(seatHolds.expiresAt, new Date()),
        isNull(seatHolds.convertedRegistrationId),
      ),
    )
    .returning({ id: seatHolds.id });

  return released.length;
}

/**
 * จองที่นั่งชั่วคราวระหว่างที่ผู้ใช้กรอกฟอร์ม
 *
 * ก่อนตรวจโควตา จะกวาดที่นั่งที่จองค้างหมดอายุของช่วงเวลานี้คืนก่อนเสมอ
 * ทำให้ไม่ต้องพึ่ง cron job แยก — ที่นั่งถูกคืนตอนที่มีคนต้องการใช้พอดี
 * (สำคัญมากเพราะ Vercel แพ็กเกจฟรีจำกัด cron ให้รันได้แค่วันละครั้ง)
 */
export async function holdSeat(
  db: Db,
  params: { eventId: string; sessionId: string; holdMinutes: number },
): Promise<SeatHoldResult> {
  return db.transaction(async (tx) => {
    // ① ล็อกแถวช่วงเวลาก่อนเป็นอันดับแรกเสมอ
    //    คำขออื่นที่ขอที่นั่งช่วงเดียวกันจะรอตรงนี้จนกว่าเราจะ commit
    //    (ล็อกก่อนแตะ seat_holds เพื่อให้ทุก transaction จับล็อกเรียงลำดับเดียวกัน กัน deadlock)
    const [locked] = await tx
      .select()
      .from(eventSessions)
      .where(and(eq(eventSessions.id, params.sessionId), eq(eventSessions.eventId, params.eventId)))
      .for("update");

    if (!locked) {
      return { ok: false as const, reason: "session_not_found" as const, remaining: 0 };
    }
    if (locked.isClosed) {
      return { ok: false as const, reason: "session_closed" as const, remaining: 0 };
    }

    // ② คืนที่นั่งที่จองค้างหมดอายุก่อนตรวจโควตา
    const releasedCount = await releaseExpiredHoldsForSession(tx, params.sessionId);
    const reservedNow = Math.max(locked.reservedCount - releasedCount, 0);

    // ③ ตรวจว่ายังมีที่นั่งเหลือหรือไม่
    const remaining = locked.quota - reservedNow;
    if (remaining <= 0) {
      if (releasedCount > 0) {
        await tx
          .update(eventSessions)
          .set({ reservedCount: reservedNow, updatedAt: new Date() })
          .where(eq(eventSessions.id, params.sessionId));
      }
      return { ok: false as const, reason: "sold_out" as const, remaining: 0 };
    }

    // ④ จองที่นั่งและอัปเดตตัวนับ
    const expiresAt = new Date(Date.now() + params.holdMinutes * 60_000);
    const [hold] = await tx
      .insert(seatHolds)
      .values({ eventId: params.eventId, sessionId: params.sessionId, expiresAt })
      .returning({ holdToken: seatHolds.holdToken });

    if (!hold) throw new Error("สร้างการจองที่นั่งไม่สำเร็จ");

    await tx
      .update(eventSessions)
      .set({ reservedCount: reservedNow + 1, updatedAt: new Date() })
      .where(eq(eventSessions.id, params.sessionId));

    return {
      ok: true as const,
      holdToken: hold.holdToken,
      expiresAt,
      remaining: remaining - 1,
    };
  });
}

/**
 * ยกเลิกการจองที่นั่ง (ผู้ใช้กดย้อนกลับ หรือปิดหน้าเว็บ)
 * คืนค่า true ถ้าคืนที่นั่งสำเร็จ
 */
export async function releaseHold(db: Db, holdToken: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [hold] = await tx
      .select({ sessionId: seatHolds.sessionId })
      .from(seatHolds)
      .where(and(eq(seatHolds.holdToken, holdToken), isNull(seatHolds.convertedRegistrationId)));

    if (!hold) return false;

    // ล็อกแถวช่วงเวลาก่อนเสมอ ตามลำดับเดียวกับ holdSeat
    await tx
      .select({ id: eventSessions.id })
      .from(eventSessions)
      .where(eq(eventSessions.id, hold.sessionId))
      .for("update");

    await tx.delete(seatHolds).where(eq(seatHolds.holdToken, holdToken));
    await tx
      .update(eventSessions)
      .set({
        // greatest(...) กัน reservedCount ติดลบถ้าข้อมูลไม่ตรงกัน
        reservedCount: sql`greatest(${eventSessions.reservedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(eventSessions.id, hold.sessionId));

    return true;
  });
}

/**
 * กวาดที่นั่งหมดอายุของทุกช่วงเวลาในครั้งเดียว
 *
 * ระบบไม่ได้พึ่งฟังก์ชันนี้ในการทำงานปกติ (holdSeat กวาดให้เองอยู่แล้ว)
 * แต่มีไว้เผื่อ 2 กรณี: ใช้เป็น cron สำรอง และใช้ทำให้ตัวเลขที่นั่งคงเหลือ
 * บนหน้าเว็บแม่นยำแม้ยังไม่มีใครกดจองมาสักพัก
 */
export async function releaseAllExpiredHolds(db: Db): Promise<number> {
  const expired = await db
    .select({ sessionId: seatHolds.sessionId })
    .from(seatHolds)
    .where(and(lt(seatHolds.expiresAt, new Date()), isNull(seatHolds.convertedRegistrationId)));

  const sessionIds = [...new Set(expired.map((r) => r.sessionId))];
  let total = 0;

  for (const sessionId of sessionIds) {
    total += await db.transaction(async (tx) => {
      await tx
        .select({ id: eventSessions.id })
        .from(eventSessions)
        .where(eq(eventSessions.id, sessionId))
        .for("update");

      const n = await releaseExpiredHoldsForSession(tx, sessionId);
      if (n > 0) {
        await tx
          .update(eventSessions)
          .set({
            reservedCount: sql`greatest(${eventSessions.reservedCount} - ${n}, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(eventSessions.id, sessionId));
      }
      return n;
    });
  }

  return total;
}
