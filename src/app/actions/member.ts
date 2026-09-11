"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { members } from "@/db/schema";
import { hashIdentifier } from "@/lib/hash";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/tracking";
import { memberSignUpSchema, toFieldErrors } from "@/lib/validation";

/**
 * สมัครสมาชิกสำหรับผู้เข้าร่วมงาน
 *
 * ⚠️ นี่ไม่ใช่ระบบล็อกอิน และต้องไม่กลายเป็นระบบล็อกอินในอนาคตโดยไม่ตั้งใจ
 *    สมาชิกไม่มีรหัสผ่าน เข้าหลังบ้านไม่ได้ และเก็บอยู่คนละตารางกับเจ้าหน้าที่
 *    ข้อมูลนี้มีไว้ให้กรอกครั้งเดียวแล้วใช้ซ้ำตอนสมัครงานแต่ละงาน
 */

export type MemberSignUpResult =
  | { ok: true; message: string }
  | { ok: false; message?: string; fieldErrors: Record<string, string> };

export async function signUpMemberAction(rawInput: unknown): Promise<MemberSignUpResult> {
  const parsed = memberSignUpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  // honeypot — บอทจะกรอกช่องที่คนมองไม่เห็น
  if (input.website.length > 0) {
    return { ok: false, fieldErrors: {}, message: "ตรวจพบการส่งข้อมูลที่ผิดปกติ" };
  }

  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);

  /**
   * จำกัดจำนวนครั้งต่อที่อยู่เครือข่าย
   * ใช้เพดานเดียวกับการลงทะเบียนงาน เพราะเป็นการกรอกฟอร์มโดยคนเหมือนกัน
   * และคนหน้างานหลายสิบคนอาจต่อ Wi-Fi เดียวกัน
   */
  if (clientIp) {
    const limit = await checkRateLimit(
      rateLimitKey("member", clientIp),
      RATE_LIMITS.register.limit,
      RATE_LIMITS.register.windowSeconds,
    );
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return {
        ok: false,
        fieldErrors: {},
        message: `ส่งข้อมูลถี่เกินไป กรุณารออีกประมาณ ${minutes} นาทีแล้วลองใหม่`,
      };
    }
  }

  const existing = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, input.email));

  if (existing.length > 0) {
    return {
      ok: false,
      fieldErrors: { email: "อีเมลนี้สมัครสมาชิกไว้แล้ว" },
    };
  }

  try {
    await db.insert(members).values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      photoUrl: input.photoUrl,
      ipHash: clientIp ? hashIdentifier(clientIp) : null,
      userAgent: requestHeaders.get("user-agent"),
      policyVersion: "1.0",
    });
  } catch (error) {
    // อีเมลซ้ำที่หลุดมาถึงชั้นฐานข้อมูล (คนละคนกดพร้อมกันด้วยอีเมลเดียวกัน)
    if (error instanceof Error && /members_email_uq/.test(error.message)) {
      return { ok: false, fieldErrors: { email: "อีเมลนี้สมัครสมาชิกไว้แล้ว" } };
    }
    console.error("[member] สมัครสมาชิกไม่สำเร็จ:", error);
    return {
      ok: false,
      fieldErrors: {},
      message: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }

  return { ok: true, message: "สมัครสมาชิกเรียบร้อยแล้ว" };
}
