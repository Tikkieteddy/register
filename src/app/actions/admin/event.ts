"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/db";
import { eventSessions, events } from "@/db/schema";
import { ADMIN_EVENT_COOKIE } from "@/lib/admin/current-event";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";
import { validateSlug } from "@/lib/slug";

export type EventActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  slug?: string;
};

/**
 * แปลงวันที่กับเวลาที่ผู้ดูแลกรอก ให้เป็นเวลาจริงตามโซนเวลาไทย
 *
 * ⚠️ ต้องระบุ +07:00 ต่อท้ายเสมอ ห้ามใช้ new Date("2026-03-14T09:00")
 *    เพราะรูปแบบนั้นจะถูกตีความตามโซนเวลาของ "เครื่องที่รันโค้ด"
 *    ซึ่งบน Vercel คือ UTC — งานที่ตั้งไว้ 09:00 น. จะกลายเป็น 16:00 น.
 *    ผิดไป 7 ชั่วโมงโดยไม่มีอะไรเตือน
 */
function bangkokTime(date: string, time: string): Date | null {
  const value = new Date(`${date}T${time}:00+07:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

/* ------------------------------------------------------------------ */
/* สลับงานที่กำลังจัดการ                                               */
/* ------------------------------------------------------------------ */

export async function selectEventAction(slug: string): Promise<EventActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const [target] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug));
  if (!target) return { ok: false, message: "ไม่พบงานที่เลือก" };

  const jar = await cookies();
  jar.set(ADMIN_EVENT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  // ทุกหน้าในหลังบ้านอ่านงานปัจจุบันจากคุกกี้เดียวกัน จึงต้องล้างแคชทั้งกลุ่ม
  revalidatePath("/admin", "layout");
  return { ok: true, message: "สลับงานเรียบร้อย", slug };
}

/* ------------------------------------------------------------------ */
/* สร้างงานใหม่                                                        */
/* ------------------------------------------------------------------ */

export type CreateEventInput = {
  nameTh: string;
  nameEn: string;
  slug: string;
  category: string;
  venueName: string;
  eventDate: string;
  morningStart: string;
  morningEnd: string;
  morningQuota: number;
  afternoonStart: string;
  afternoonEnd: string;
  afternoonQuota: number;
};

/**
 * สร้างงานใหม่พร้อมช่วงเวลาภาคเช้า-ภาคบ่าย
 *
 * งานใหม่จะเป็นสถานะ "ฉบับร่าง" เสมอ ไม่เผยแพร่ทันที
 * เพราะยังต้องไปตั้งค่าคำถามในฟอร์มและรายละเอียดงานอีกหลายอย่าง
 * ถ้าเผยแพร่ทันทีตั้งแต่กดสร้าง คนอาจเข้ามาลงทะเบียนกับงานที่ยังไม่พร้อม
 */
export async function createEventAction(input: CreateEventInput): Promise<EventActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const fieldErrors: Record<string, string> = {};

  const nameTh = input.nameTh.trim();
  if (!nameTh) fieldErrors.nameTh = "โปรดระบุชื่องาน";

  const slug = input.slug.trim().toLowerCase();
  const slugError = validateSlug(slug);
  if (slugError) fieldErrors.slug = slugError;

  if (!input.eventDate) fieldErrors.eventDate = "โปรดระบุวันที่จัดงาน";

  const morningStart = bangkokTime(input.eventDate, input.morningStart);
  const morningEnd = bangkokTime(input.eventDate, input.morningEnd);
  const afternoonStart = bangkokTime(input.eventDate, input.afternoonStart);
  const afternoonEnd = bangkokTime(input.eventDate, input.afternoonEnd);

  if (!morningStart || !morningEnd || !afternoonStart || !afternoonEnd) {
    fieldErrors.eventDate = "วันที่หรือเวลาไม่ถูกต้อง";
  } else {
    if (morningEnd <= morningStart) fieldErrors.morningEnd = "เวลาสิ้นสุดต้องหลังเวลาเริ่ม";
    if (afternoonEnd <= afternoonStart) fieldErrors.afternoonEnd = "เวลาสิ้นสุดต้องหลังเวลาเริ่ม";
    if (afternoonStart < morningEnd) fieldErrors.afternoonStart = "ภาคบ่ายต้องเริ่มหลังภาคเช้าจบ";
  }

  if (!Number.isInteger(input.morningQuota) || input.morningQuota < 0) {
    fieldErrors.morningQuota = "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
  }
  if (!Number.isInteger(input.afternoonQuota) || input.afternoonQuota < 0) {
    fieldErrors.afternoonQuota = "จำนวนที่นั่งต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "ข้อมูลยังไม่ครบหรือไม่ถูกต้อง", fieldErrors };
  }
  if (!morningStart || !morningEnd || !afternoonStart || !afternoonEnd) {
    return { ok: false, message: "วันที่หรือเวลาไม่ถูกต้อง" };
  }

  const [duplicate] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug));
  if (duplicate) {
    return {
      ok: false,
      message: "ชื่อลิงก์นี้ถูกใช้ไปแล้ว",
      fieldErrors: { slug: "มีงานอื่นใช้ชื่อลิงก์นี้อยู่แล้ว โปรดเปลี่ยนเป็นชื่ออื่น" },
    };
  }

  /**
   * สร้างงานกับช่วงเวลาใน transaction เดียว
   * ถ้าสร้างงานสำเร็จแต่ช่วงเวลาล้ม จะได้งานที่ไม่มีที่นั่งให้ลงทะเบียนเลย
   * ซึ่งหน้าเว็บจะแสดงว่า "ที่นั่งเต็ม" ทั้งที่ยังไม่มีใครลงทะเบียนสักคน
   */
  const created = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        slug,
        nameTh,
        nameEn: input.nameEn.trim() || null,
        category: input.category.trim() || null,
        venueName: input.venueName.trim() || null,
        startsAt: morningStart,
        endsAt: afternoonEnd,
        status: "draft",
      })
      .returning({ id: events.id, slug: events.slug });

    if (!event) throw new Error("สร้างงานไม่สำเร็จ");

    await tx.insert(eventSessions).values([
      {
        eventId: event.id,
        code: "morning",
        nameTh: "ภาคเช้า",
        nameEn: "Morning",
        startsAt: morningStart,
        endsAt: morningEnd,
        quota: input.morningQuota,
        sortOrder: 1,
      },
      {
        eventId: event.id,
        code: "afternoon",
        nameTh: "ภาคบ่าย",
        nameEn: "Afternoon",
        startsAt: afternoonStart,
        endsAt: afternoonEnd,
        quota: input.afternoonQuota,
        sortOrder: 2,
      },
    ]);

    return event;
  });

  await recordAudit({
    userId: admin.id,
    action: "create",
    entityType: "event",
    entityId: created.id,
    after: { slug, nameTh, quota: input.morningQuota + input.afternoonQuota },
  });

  // สร้างเสร็จแล้วให้หลังบ้านเด้งไปทำงานกับงานใหม่ทันที ไม่ต้องไปกดสลับเอง
  const jar = await cookies();
  jar.set(ADMIN_EVENT_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/");
  return { ok: true, message: `สร้างงาน “${nameTh}” เรียบร้อย`, slug };
}
