import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { eventSessions, seatHolds } from "@/db/schema";

/**
 * ตัดโควตาที่นั่ง — จุดที่สำคัญที่สุดของทั้งระบบ
 *
 * ปัญหาที่ต้องกัน: ตอนเปิดรับลงทะเบียนจะมีคนกดพร้อมกัน 100–300 คนใน 5–10 นาทีแรก
 * (ดูข้อกำหนด E1) ถ้าอ่านค่า reservedCount มาบวกแล้วเขียนกลับแบบธรรมดา
 * สองคำขอที่มาพร้อมกันจะอ่านค่าเดิมค่าเดียวกัน แล้วเขียนทับกัน = รับเกินโควตา
 *
 * วิธีแก้: ทำทั้งหมดใน transaction เดียว และล็อกแถวด้วย SELECT ... FOR UPDATE
 * คำขอที่สองจะรอจนคำขอแรกเสร็จ แล้วค่อยอ่านค่าที่อัปเดตแล้ว
 */
export type SeatHoldResult =
  | { ok: true; holdToken: string; expiresAt: Date }
  | { ok: false; reason: "session_not_found" | "session_closed" | "sold_out"; remaining: number };

export async function holdSeat(
  db: Db,
  params: { eventId: string; sessionId: string; holdMinutes: number },
): Promise<SeatHoldResult> {
  return db.transaction(async (tx) => {
    // ล็อกแถวช่วงเวลานี้ไว้ก่อน — คำขออื่นที่ขอที่นั่งช่วงเดียวกันต้องรอตรงนี้
    const [session] = await tx
      .select()
      .from(eventSessions)
      .where(sql`${eventSessions.id} = ${params.sessionId} AND ${eventSessions.eventId} = ${params.eventId}`)
      .for("update");

    if (!session) return { ok: false as const, reason: "session_not_found" as const, remaining: 0 };
    if (session.isClosed) {
      return { ok: false as const, reason: "session_closed" as const, remaining: 0 };
    }

    const remaining = session.quota - session.reservedCount;
    if (remaining <= 0) {
      return { ok: false as const, reason: "sold_out" as const, remaining: 0 };
    }

    const expiresAt = new Date(Date.now() + params.holdMinutes * 60_000);

    const [hold] = await tx
      .insert(seatHolds)
      .values({ eventId: params.eventId, sessionId: params.sessionId, expiresAt })
      .returning({ holdToken: seatHolds.holdToken });

    if (!hold) throw new Error("สร้างการจองที่นั่งไม่สำเร็จ");

    await tx
      .update(eventSessions)
      .set({ reservedCount: session.reservedCount + 1, updatedAt: new Date() })
      .where(sql`${eventSessions.id} = ${params.sessionId}`);

    return { ok: true as const, holdToken: hold.holdToken, expiresAt };
  });
}

/**
 * คืนที่นั่งที่จองค้างเกินเวลา — เรียกจาก background job ทุก 5 นาที
 * คืนค่าเป็นจำนวนที่นั่งที่คืนกลับเข้าระบบ
 */
export async function releaseExpiredHolds(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .delete(seatHolds)
      .where(sql`${seatHolds.expiresAt} < now() AND ${seatHolds.convertedRegistrationId} IS NULL`)
      .returning({ sessionId: seatHolds.sessionId });

    if (expired.length === 0) return 0;

    const counts = new Map<string, number>();
    for (const row of expired) counts.set(row.sessionId, (counts.get(row.sessionId) ?? 0) + 1);

    for (const [sessionId, n] of counts) {
      await tx
        .update(eventSessions)
        .set({
          // greatest(...) กัน reservedCount ติดลบถ้าเกิดข้อมูลไม่ตรงกัน
          reservedCount: sql`greatest(${eventSessions.reservedCount} - ${n}, 0)`,
          updatedAt: new Date(),
        })
        .where(sql`${eventSessions.id} = ${sessionId}`);
    }

    return expired.length;
  });
}
