"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { getEventBySlug } from "@/db/queries";
import {
  checkIns,
  consents,
  eventSessions,
  registrationSessions,
  registrations,
  tickets,
} from "@/db/schema";
import { canScan, getSession } from "@/lib/auth/session";
import { generateRegistrationCode, generateTicketCode } from "@/lib/codes";
import { hashIdentifier } from "@/lib/hash";
import { getClientIp } from "@/lib/tracking";
import { nameSchema, phoneSchema } from "@/lib/validation";

/**
 * ลงทะเบียนหน้างาน (Walk-in) ตามข้อกำหนด B1
 *
 * ฟอร์มย่อ กรอกเร็วไม่เกิน 30 วินาที
 * สร้างรายการใหม่และเช็คอินให้ทันทีในขั้นตอนเดียว
 *
 * ⚠️ ต้องให้ผู้ร่วมงานอ่านและกดยินยอม PDPA เองพร้อมบันทึก timestamp เป็นหลักฐาน
 */
export type WalkInResult =
  | { ok: true; qrToken: string; registrationCode: string; firstName: string; lastName: string }
  | { ok: false; fieldErrors: Record<string, string>; message?: string };

export async function walkInAction(input: {
  eventSlug: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  occupation?: string;
  sessionIds: string[];
  consentPhoto: boolean;
  consentPdpa: boolean;
  deviceId?: string;
}): Promise<WalkInResult> {
  const staff = await getSession();
  if (!canScan(staff)) {
    return { ok: false, fieldErrors: {}, message: "ไม่มีสิทธิ์ลงทะเบียนหน้างาน" };
  }

  const fieldErrors: Record<string, string> = {};

  const first = nameSchema.safeParse(input.firstName);
  if (!first.success) fieldErrors.firstName = first.error.issues[0]?.message ?? "โปรดระบุ";
  const last = nameSchema.safeParse(input.lastName);
  if (!last.success) fieldErrors.lastName = last.error.issues[0]?.message ?? "โปรดระบุ";
  const phone = phoneSchema.safeParse(input.phone);
  if (!phone.success) fieldErrors.phone = phone.error.issues[0]?.message ?? "โปรดระบุ";
  if (input.sessionIds.length === 0) fieldErrors.sessionIds = "โปรดเลือกช่วงเวลา";
  if (!input.consentPhoto) fieldErrors.consentPhoto = "ต้องได้รับความยินยอมให้บันทึกภาพ";
  if (!input.consentPdpa) fieldErrors.consentPdpa = "ต้องได้รับความยินยอมตาม PDPA";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const data = await getEventBySlug(input.eventSlug);
  if (!data) return { ok: false, fieldErrors: {}, message: "ไม่พบงาน" };

  const validSessions = new Set(data.sessions.map((s) => s.id));
  if (!input.sessionIds.every((id) => validSessions.has(id))) {
    return { ok: false, fieldErrors: { sessionIds: "ช่วงเวลาไม่ถูกต้อง" } };
  }

  // ตรวจโควตา — แต่ Admin ตั้งค่าให้ walk-in เกินโควตาได้ เพราะหน้างานจริงต้องยืดหยุ่น
  if (!data.event.allowWalkinOverQuota) {
    const full = input.sessionIds.some((id) => data.sessions.find((s) => s.id === id)?.isFull);
    if (full) {
      return {
        ok: false,
        fieldErrors: { sessionIds: "ช่วงเวลาที่เลือกเต็มแล้ว" },
        message: "ที่นั่งเต็ม และการตั้งค่าไม่อนุญาตให้ลงทะเบียนเกินโควตา",
      };
    }
  }

  const email = input.email?.trim().toLowerCase() ?? "";
  if (email) {
    const existing = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.eventId, data.event.id), eq(registrations.email, email)));
    if (existing.length > 0) {
      return {
        ok: false,
        fieldErrors: { email: "อีเมลนี้ลงทะเบียนไว้แล้ว กรุณาใช้ปุ่มค้นหาแทน" },
      };
    }
  }

  const h = await headers();
  const ip = getClientIp(h);
  const ipHash = ip ? hashIdentifier(ip) : null;
  const userAgent = h.get("user-agent");

  const registrationCode = generateRegistrationCode();
  const ticketCode = generateTicketCode(registrationCode);
  const now = new Date();

  try {
    const created = await db.transaction(async (tx) => {
      const [registration] = await tx
        .insert(registrations)
        .values({
          eventId: data.event.id,
          registrationCode,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          // ไม่มีอีเมลก็ลงทะเบียนได้ ใช้ที่อยู่ภายในที่ไม่ส่งจริงแทนเพื่อคง unique index
          email: email || `walkin+${registrationCode.toLowerCase()}@invalid.local`,
          phone: phone.data ?? input.phone,
          occupation: input.occupation?.trim() || null,
          status: "confirmed",
          source: "walkin",
          locale: "th",
          ipHash,
          userAgent,
        })
        .returning({ id: registrations.id });

      if (!registration) throw new Error("บันทึกผู้ลงทะเบียนไม่สำเร็จ");

      await tx
        .insert(registrationSessions)
        .values(input.sessionIds.map((sessionId) => ({ registrationId: registration.id, sessionId })));

      await tx.insert(consents).values(
        (
          [
            ["photo", input.consentPhoto],
            ["pdpa", input.consentPdpa],
          ] as const
        ).map(([type, granted]) => ({
          registrationId: registration.id,
          type,
          isGranted: granted,
          policyVersion: data.event.privacyPolicyVersion,
          ipHash,
          userAgent,
        })),
      );

      const [ticket] = await tx
        .insert(tickets)
        .values({
          registrationId: registration.id,
          ticketCode,
          holderFirstName: input.firstName.trim(),
          holderLastName: input.lastName.trim(),
          holderEmail: email || `walkin+${registrationCode.toLowerCase()}@invalid.local`,
        })
        .returning({ id: tickets.id, qrToken: tickets.qrToken });

      if (!ticket) throw new Error("ออกตั๋วไม่สำเร็จ");

      // เช็คอินทันทีในขั้นตอนเดียว — คนอยู่ตรงหน้าอยู่แล้ว
      const firstSessionId = input.sessionIds[0];
      if (firstSessionId) {
        await tx.insert(checkIns).values({
          ticketId: ticket.id,
          sessionId: firstSessionId,
          staffUserId: staff?.id ?? null,
          checkedInAt: now,
          syncedAt: now,
          method: "walkin",
          deviceId: input.deviceId ?? null,
        });

        await tx
          .update(eventSessions)
          .set({
            checkedInCount: sql`${eventSessions.checkedInCount} + 1`,
            reservedCount: sql`${eventSessions.reservedCount} + 1`,
            updatedAt: now,
          })
          .where(eq(eventSessions.id, firstSessionId));
      }

      return { qrToken: ticket.qrToken };
    });

    return {
      ok: true,
      qrToken: created.qrToken,
      registrationCode,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    };
  } catch (error) {
    console.error("[walkin] บันทึกไม่สำเร็จ:", error);
    return { ok: false, fieldErrors: {}, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}
