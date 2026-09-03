"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { getEventBySlug, getFormQuestions, getShareLinkByCode } from "@/db/queries";
import { eventSessions, seatHolds } from "@/db/schema";
import { holdSeat, releaseHold } from "@/lib/quota";
import { getClientIp, trackLinkEvent } from "@/lib/tracking";

/**
 * Server Actions ของฟอร์มลงทะเบียน
 *
 * ⚠️ ทุกฟังก์ชันในไฟล์นี้ทำงานฝั่งเซิร์ฟเวอร์ และต้องตรวจสอบข้อมูลซ้ำเสมอ
 *    ห้ามเชื่อค่าใด ๆ ที่ส่งมาจากฝั่ง client
 */

export type HoldSeatResponse =
  | { ok: true; holdToken: string; expiresAt: string; remaining: number }
  | { ok: false; message: string; remaining: number };

/**
 * จองที่นั่งชั่วคราวเมื่อผู้ใช้ติ๊กเลือกช่วงเวลา
 *
 * จองทันทีที่เลือก ไม่รอตอนกดส่ง เพื่อให้ที่นั่งถูกกันไว้จริงระหว่างกรอกฟอร์ม
 * และเพื่อให้ช่วงที่เต็มแล้วขึ้นสถานะ "เต็มแล้ว" ได้ทันทีตามข้อกำหนด D3
 */
export async function holdSeatAction(
  eventSlug: string,
  sessionId: string,
): Promise<HoldSeatResponse> {
  const data = await getEventBySlug(eventSlug);
  if (!data) return { ok: false, message: "ไม่พบงานที่ต้องการ", remaining: 0 };

  if (data.registrationState !== "open") {
    return { ok: false, message: "ขณะนี้ปิดรับลงทะเบียนแล้ว", remaining: 0 };
  }

  // ตรวจว่าช่วงเวลานี้เป็นของงานนี้จริง ไม่ใช่ id ที่ถูกยัดมาจากฝั่ง client
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, message: "ไม่พบช่วงเวลาที่เลือก", remaining: 0 };

  const result = await holdSeat(db, {
    eventId: data.event.id,
    sessionId,
    holdMinutes: data.event.seatHoldMinutes,
  });

  if (!result.ok) {
    const message =
      result.reason === "sold_out"
        ? `${session.nameTh}มีผู้ลงทะเบียนเต็มแล้ว กรุณาเลือกช่วงเวลาอื่น`
        : result.reason === "session_closed"
          ? `${session.nameTh}ปิดรับลงทะเบียนแล้ว`
          : "ไม่พบช่วงเวลาที่เลือก";
    return { ok: false, message, remaining: result.remaining };
  }

  return {
    ok: true,
    holdToken: result.holdToken,
    expiresAt: result.expiresAt.toISOString(),
    remaining: result.remaining,
  };
}

/** คืนที่นั่งเมื่อผู้ใช้ติ๊กช่วงเวลาออก */
export async function releaseSeatAction(holdToken: string): Promise<{ ok: boolean }> {
  const released = await releaseHold(db, holdToken);
  return { ok: released };
}

/** ที่นั่งคงเหลือแบบสด ใช้รีเฟรชตัวเลขบนหน้าฟอร์ม */
export async function getRemainingSeatsAction(
  eventSlug: string,
): Promise<{ sessionId: string; remaining: number; isFull: boolean; isClosed: boolean }[]> {
  const data = await getEventBySlug(eventSlug);
  if (!data) return [];
  return data.sessions.map((s) => ({
    sessionId: s.id,
    remaining: s.remaining,
    isFull: s.isFull,
    isClosed: s.isClosed,
  }));
}

/** ตรวจว่าโทเคนที่ client ถืออยู่ยังไม่หมดอายุ — เรียกก่อนส่งฟอร์มจริง */
export async function verifyHoldsAction(
  holdTokens: string[],
): Promise<{ ok: boolean; expiredCount: number }> {
  if (holdTokens.length === 0) return { ok: false, expiredCount: 0 };

  const rows = await db
    .select({ token: seatHolds.holdToken, expiresAt: seatHolds.expiresAt })
    .from(seatHolds)
    .where(inArray(seatHolds.holdToken, holdTokens));

  const now = new Date();
  const valid = rows.filter((r) => r.expiresAt > now);
  return { ok: valid.length === holdTokens.length, expiredCount: holdTokens.length - valid.length };
}

/** บันทึกว่ามีคนเปิดหน้าฟอร์ม — ใช้ทำกราฟกรวยการแปลง (กราฟที่ 9) */
export async function trackFormViewAction(eventId: string, shareLinkCode?: string): Promise<void> {
  const h = await headers();
  let shareLinkId: string | null = null;

  if (shareLinkCode) {
    const link = await getShareLinkByCode(shareLinkCode);
    shareLinkId = link?.id ?? null;
  }

  await trackLinkEvent({
    eventId,
    action: "view_form",
    shareLinkId,
    ip: getClientIp(h),
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
    country: h.get("cf-ipcountry"),
  });
}

/** ใช้ตอนตรวจคำตอบฝั่งเซิร์ฟเวอร์ — ดึงกติกาของคำถามจากฐานข้อมูล ไม่เชื่อค่าจาก client */
export async function getQuestionRulesAction(eventId: string) {
  const questions = await getFormQuestions(eventId);
  return questions.map((q) => ({
    id: q.id,
    labelTh: q.labelTh,
    isRequired: q.isRequired,
    minSelect: q.minSelect,
    maxSelect: q.maxSelect,
    hasOtherOption: q.hasOtherOption,
    otherOptionIds: q.options.filter((o) => o.isOther).map((o) => o.id),
  }));
}

/** ตรวจว่าช่วงเวลาที่ส่งมาเป็นของงานนี้จริง */
export async function assertSessionsBelongToEvent(
  eventId: string,
  sessionIds: string[],
): Promise<boolean> {
  if (sessionIds.length === 0) return false;
  const rows = await db
    .select({ id: eventSessions.id })
    .from(eventSessions)
    .where(and(eq(eventSessions.eventId, eventId), inArray(eventSessions.id, sessionIds)));
  return rows.length === sessionIds.length;
}
