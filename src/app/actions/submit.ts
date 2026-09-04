"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { getEventBySlug, getFormQuestions, getShareLinkByCode } from "@/db/queries";
import {
  consents,
  registrationAnswers,
  registrationSessions,
  registrations,
  seatHolds,
  shareLinks,
  tickets,
} from "@/db/schema";
import { generateRegistrationCode, generateTicketCode } from "@/lib/codes";
import { sendConfirmationEmail } from "@/lib/email/confirmation";
import { hashIdentifier } from "@/lib/hash";
import { getClientIp } from "@/lib/tracking";
import {
  registrationInputSchema,
  toFieldErrors,
  validateAnswer,
  type QuestionRule,
} from "@/lib/validation";

export type SubmitResult =
  | { ok: true; registrationCode: string; ticketToken: string }
  | { ok: false; fieldErrors: Record<string, string>; message?: string }
  | { ok: false; fieldErrors: Record<string, string>; message: string; holdsExpired: true };

/**
 * บันทึกการลงทะเบียน — งานหลักของเฟส 3
 *
 * ⚠️ ตรวจสอบทุกอย่างซ้ำฝั่งเซิร์ฟเวอร์ ห้ามเชื่อข้อมูลจากฝั่ง client เด็ดขาด
 *    รวมถึงกติกาของคำถาม ซึ่งดึงจากฐานข้อมูลใหม่ ไม่ใช้ค่าที่ client ส่งมา
 *
 * ทุกอย่างอยู่ใน transaction เดียว ถ้าขั้นตอนไหนล้ม จะย้อนกลับทั้งหมด
 * ไม่ให้เกิดสภาพ "ตัดโควตาไปแล้วแต่ไม่มีเรคคอร์ดผู้ลงทะเบียน"
 */
export async function submitRegistrationAction(rawInput: unknown): Promise<SubmitResult> {
  // ---------- ① ตรวจรูปแบบข้อมูลพื้นฐาน ----------
  const parsed = registrationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // honeypot: ช่องซ่อนที่คนมองไม่เห็น ถ้ามีค่าแปลว่าเป็น bot
  if (input.website.length > 0) {
    return { ok: false, fieldErrors: {}, message: "ตรวจพบการส่งข้อมูลที่ผิดปกติ" };
  }

  const data = await getEventBySlug(input.eventSlug);
  if (!data) return { ok: false, fieldErrors: {}, message: "ไม่พบงานที่ต้องการ" };
  const { event } = data;

  if (data.registrationState !== "open") {
    return { ok: false, fieldErrors: {}, message: "ขณะนี้ปิดรับลงทะเบียนแล้ว" };
  }

  // ---------- ② ตรวจว่าช่วงเวลาที่ส่งมาเป็นของงานนี้จริง ----------
  const validSessionIds = new Set(data.sessions.map((s) => s.id));
  if (!input.sessionIds.every((id) => validSessionIds.has(id))) {
    return {
      ok: false,
      fieldErrors: { sessionIds: "ช่วงเวลาที่เลือกไม่ถูกต้อง" },
      message: "ช่วงเวลาที่เลือกไม่ถูกต้อง",
    };
  }

  // ---------- ③ ตรวจคำตอบตามกติกาที่ดึงจากฐานข้อมูล ----------
  const questions = await getFormQuestions(event.id);
  const answerByQuestion = new Map(input.answers.map((a) => [a.questionId, a]));
  const fieldErrors: Record<string, string> = {};

  for (const q of questions) {
    const rule: QuestionRule = {
      id: q.id,
      labelTh: q.labelTh,
      isRequired: q.isRequired,
      minSelect: q.minSelect,
      maxSelect: q.maxSelect,
      hasOtherOption: q.hasOtherOption,
      otherOptionIds: q.options.filter((o) => o.isOther).map((o) => o.id),
    };
    const message = validateAnswer(rule, answerByQuestion.get(q.id));
    if (message) fieldErrors[`q_${q.id}`] = message;

    // ตรวจว่า optionId ที่ส่งมาเป็นของคำถามข้อนี้จริง
    const allowed = new Set(q.options.map((o) => o.id));
    const picked = answerByQuestion.get(q.id)?.optionIds ?? [];
    if (!picked.every((id) => allowed.has(id))) {
      fieldErrors[`q_${q.id}`] = "ตัวเลือกที่ส่งมาไม่ถูกต้อง";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // ---------- ④ ตรวจอีเมลซ้ำ ----------
  const existing = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.eventId, event.id), eq(registrations.email, input.email)));

  if (existing.length > 0) {
    return {
      ok: false,
      fieldErrors: {
        email:
          'อีเมลนี้ได้ลงทะเบียนไว้แล้ว หากคุณไม่ได้รับอีเมลยืนยัน กรุณากด "ส่งอีเมลซ้ำ"',
      },
    };
  }

  // ---------- ⑤ เก็บข้อมูลบริบทสำหรับ audit และ PDPA ----------
  const h = await headers();
  const ip = getClientIp(h);
  const ipHash = ip ? hashIdentifier(ip) : null;
  const userAgent = h.get("user-agent");

  const shareLink = input.shareLinkCode ? await getShareLinkByCode(input.shareLinkCode) : null;

  const registrationCode = generateRegistrationCode();
  const ticketCode = generateTicketCode(registrationCode);

  // ---------- ⑥ บันทึกทั้งหมดใน transaction เดียว ----------
  let created: { registrationId: string; ticketToken: string } | null = null;

  try {
    created = await db.transaction(async (tx) => {
      // ยืนยันว่าโทเคนจองที่นั่งยังไม่หมดอายุ ณ วินาทีที่บันทึกจริง
      const holds = await tx
        .select()
        .from(seatHolds)
        .where(inArray(seatHolds.holdToken, input.holdTokens))
        .for("update");

      const now = new Date();
      const liveHolds = holds.filter(
        (hold) => hold.expiresAt > now && hold.convertedRegistrationId === null,
      );

      if (liveHolds.length !== input.sessionIds.length) {
        throw new Error("HOLDS_EXPIRED");
      }

      const heldSessionIds = new Set(liveHolds.map((hold) => hold.sessionId));
      if (!input.sessionIds.every((id) => heldSessionIds.has(id))) {
        throw new Error("HOLDS_EXPIRED");
      }

      const [registration] = await tx
        .insert(registrations)
        .values({
          eventId: event.id,
          registrationCode,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          phoneCountryCode: input.phoneCountryCode,
          status: "confirmed",
          source: "online",
          shareLinkId: shareLink?.id ?? null,
          utmSource: input.utmSource ?? shareLink?.channel ?? null,
          utmMedium: input.utmMedium ?? shareLink?.medium ?? null,
          utmCampaign: input.utmCampaign ?? shareLink?.campaign ?? null,
          locale: input.locale,
          ipHash,
          userAgent,
          saveForNextTime: input.saveForNextTime,
        })
        .returning({ id: registrations.id });

      if (!registration) throw new Error("บันทึกผู้ลงทะเบียนไม่สำเร็จ");

      // ช่วงเวลาที่เลือก
      await tx.insert(registrationSessions).values(
        input.sessionIds.map((sessionId) => ({
          registrationId: registration.id,
          sessionId,
        })),
      );

      // คำตอบของคำถามเพิ่มเติม — 1 ตัวเลือกที่ติ๊ก = 1 แถว
      // คำถามที่ตอบเป็นข้อความล้วน (ไม่มีตัวเลือก) จะเก็บเป็นแถวเดียวที่ optionId เป็น null
      const answerRows: (typeof registrationAnswers.$inferInsert)[] = [];
      for (const a of input.answers) {
        if (a.optionIds.length === 0) {
          if (a.otherText) {
            answerRows.push({
              registrationId: registration.id,
              questionId: a.questionId,
              optionId: null,
              valueText: a.otherText,
            });
          }
          continue;
        }
        for (const optionId of a.optionIds) {
          answerRows.push({
            registrationId: registration.id,
            questionId: a.questionId,
            optionId,
            valueText: a.otherText ?? null,
          });
        }
      }
      if (answerRows.length > 0) await tx.insert(registrationAnswers).values(answerRows);

      // หลักฐานความยินยอม พร้อม timestamp และเวอร์ชันนโยบาย (ข้อกำหนด PDPA)
      await tx.insert(consents).values(
        (
          [
            ["photo", input.consentPhoto],
            ["pdpa", input.consentPdpa],
            ["terms", input.consentTerms],
          ] as const
        ).map(([type, granted]) => ({
          registrationId: registration.id,
          type,
          isGranted: granted,
          policyVersion: event.privacyPolicyVersion,
          ipHash,
          userAgent,
        })),
      );

      // ออกตั๋ว
      const [ticket] = await tx
        .insert(tickets)
        .values({
          registrationId: registration.id,
          ticketCode,
          holderFirstName: input.firstName,
          holderLastName: input.lastName,
          holderEmail: input.email,
        })
        .returning({ qrToken: tickets.qrToken });

      if (!ticket) throw new Error("ออกตั๋วไม่สำเร็จ");

      // ผูกการจองที่นั่งเข้ากับการลงทะเบียน เพื่อไม่ให้ job กวาดคืนภายหลัง
      await tx
        .update(seatHolds)
        .set({ convertedRegistrationId: registration.id })
        .where(inArray(seatHolds.holdToken, input.holdTokens));

      // นับยอดแปลงของลิงก์ติดตามผล (หัวข้อ 8.5)
      if (shareLink) {
        await tx
          .update(shareLinks)
          .set({ conversionCount: sql`${shareLinks.conversionCount} + 1`, updatedAt: new Date() })
          .where(eq(shareLinks.id, shareLink.id));
      }

      return { registrationId: registration.id, ticketToken: ticket.qrToken };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HOLDS_EXPIRED") {
      return {
        ok: false,
        fieldErrors: {},
        message: "การจองที่นั่งหมดอายุแล้ว กรุณาเลือกช่วงเวลาใหม่อีกครั้ง",
        holdsExpired: true,
      };
    }
    // อีเมลซ้ำที่หลุดมาถึงชั้นฐานข้อมูล (คนละคนกดพร้อมกันด้วยอีเมลเดียวกัน)
    if (error instanceof Error && /registrations_event_email_uq/.test(error.message)) {
      return {
        ok: false,
        fieldErrors: { email: "อีเมลนี้ได้ลงทะเบียนไว้แล้ว" },
      };
    }
    console.error("[submit] บันทึกการลงทะเบียนล้มเหลว:", error);
    return { ok: false, fieldErrors: {}, message: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  // ---------- ⑦ เข้าคิวส่งอีเมล โดยไม่ให้ผู้ใช้ต้องรอ ----------
  // ผู้ใช้ได้ตั๋วแล้วตั้งแต่ขั้นที่ ⑥ อีเมลเป็นของแถม ไม่ใช่ทางเดียว (หัวข้อ 8.2)
  void sendConfirmationEmail(created.registrationId).catch((error: unknown) => {
    console.error("[submit] ส่งอีเมลยืนยันไม่สำเร็จ:", error);
  });

  return { ok: true, registrationCode, ticketToken: created.ticketToken };
}
