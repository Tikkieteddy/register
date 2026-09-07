"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  consents,
  eventSessions,
  registrationSessions,
  registrations,
  tickets,
} from "@/db/schema";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";
import { generateRegistrationCode, generateTicketCode } from "@/lib/codes";
import { sendConfirmationEmail } from "@/lib/email/confirmation";
import { adjustReservedCount } from "@/lib/quota";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validation";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/* ------------------------------------------------------------------ */
/* ยกเลิกการลงทะเบียน — ต้องคืนที่นั่งเข้าระบบทันที                     */
/* ------------------------------------------------------------------ */

/**
 * ยกเลิกการลงทะเบียน (หัวข้อ 3.3)
 *
 * ⚠️ สามอย่างนี้ต้องเกิดพร้อมกันใน transaction เดียว ห้ามแยก:
 *    ① เปลี่ยนสถานะเป็น cancelled
 *    ② ทำให้ตั๋วและ QR เดิมใช้ไม่ได้ (status = void)
 *    ③ คืนที่นั่งของทุกช่วงเวลาที่คนนี้จองไว้
 *    ถ้าแยกกันแล้วล้มกลางทาง จะเหลือที่นั่งที่ไม่มีใครใช้แต่ระบบคิดว่าเต็ม
 */
export async function cancelRegistrationsAction(
  ids: string[],
  reason: string,
): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };
  if (ids.length === 0) return { ok: false, message: "ยังไม่ได้เลือกรายการ" };

  let cancelled = 0;

  for (const id of ids) {
    const done = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(registrations).where(eq(registrations.id, id));
      if (!row || row.status === "cancelled") return false;

      const sessionRows = await tx
        .select({ sessionId: registrationSessions.sessionId })
        .from(registrationSessions)
        .where(eq(registrationSessions.registrationId, id));

      // ล็อกแถวช่วงเวลาเรียงตาม id เสมอ เพื่อให้ลำดับการจับล็อกเหมือนกันทุก transaction
      // ไม่งั้นการยกเลิกหลายรายการพร้อมกันอาจเกิด deadlock
      const sorted = [...sessionRows].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
      for (const s of sorted) {
        await adjustReservedCount(tx, s.sessionId, -1);
      }

      await tx
        .update(tickets)
        .set({ status: "void", updatedAt: new Date() })
        .where(eq(tickets.registrationId, id));

      await tx
        .update(registrations)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason.trim() || "ยกเลิกโดยผู้ดูแลระบบ",
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, id));

      return true;
    });

    if (done) {
      cancelled += 1;
      await recordAudit({
        userId: admin.id,
        action: "cancel",
        entityType: "registration",
        entityId: id,
        after: { reason },
      });
    }
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");

  return cancelled > 0
    ? { ok: true, message: `ยกเลิกแล้ว ${cancelled} รายการ และคืนที่นั่งเข้าระบบเรียบร้อย` }
    : { ok: false, message: "ไม่มีรายการที่ยกเลิกได้ (อาจถูกยกเลิกไปแล้ว)" };
}

/* ------------------------------------------------------------------ */
/* แก้ไขข้อมูลผู้ลงทะเบียน                                              */
/* ------------------------------------------------------------------ */

export async function updateRegistrationAction(input: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupation?: string;
  sessionIds: string[];
}): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const fieldErrors: Record<string, string> = {};
  const first = nameSchema.safeParse(input.firstName);
  if (!first.success) fieldErrors.firstName = first.error.issues[0]?.message ?? "โปรดระบุ";
  const last = nameSchema.safeParse(input.lastName);
  if (!last.success) fieldErrors.lastName = last.error.issues[0]?.message ?? "โปรดระบุ";
  const phone = phoneSchema.safeParse(input.phone);
  if (!phone.success) fieldErrors.phone = phone.error.issues[0]?.message ?? "โปรดระบุ";
  const email = emailSchema.safeParse(input.email);
  if (!email.success) fieldErrors.email = email.error.issues[0]?.message ?? "โปรดระบุ";
  if (input.sessionIds.length === 0) fieldErrors.sessionIds = "โปรดเลือกอย่างน้อย 1 ช่วงเวลา";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "ข้อมูลยังไม่ถูกต้อง", fieldErrors };
  }

  const [before] = await db.select().from(registrations).where(eq(registrations.id, input.id));
  if (!before) return { ok: false, message: "ไม่พบรายการนี้" };

  const nextEmail = input.email.trim().toLowerCase();
  if (nextEmail !== before.email) {
    const clash = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.eventId, before.eventId), eq(registrations.email, nextEmail)));
    if (clash.length > 0) {
      return {
        ok: false,
        message: "อีเมลนี้มีผู้ลงทะเบียนอยู่แล้วในงานนี้",
        fieldErrors: { email: "อีเมลซ้ำกับผู้ลงทะเบียนรายอื่น" },
      };
    }
  }

  const result = await db.transaction(async (tx) => {
    const current = await tx
      .select({ sessionId: registrationSessions.sessionId })
      .from(registrationSessions)
      .where(eq(registrationSessions.registrationId, input.id));

    const currentIds = new Set(current.map((c) => c.sessionId));
    const nextIds = new Set(input.sessionIds);
    const toAdd = [...nextIds].filter((id) => !currentIds.has(id)).sort();
    const toRemove = [...currentIds].filter((id) => !nextIds.has(id)).sort();

    // คืนที่นั่งช่วงที่ถอดออกก่อน แล้วค่อยขอที่นั่งช่วงใหม่
    // เรียงลำดับนี้ทำให้การ "ย้ายจากเช้าไปบ่าย" ในช่วงที่นั่งใกล้เต็มยังทำได้
    for (const sessionId of toRemove) {
      await adjustReservedCount(tx, sessionId, -1);
    }
    for (const sessionId of toAdd) {
      // Admin แก้ให้เป็นรายกรณี จึงอนุญาตให้เกินโควตาได้เหมือน walk-in
      const okSeat = await adjustReservedCount(tx, sessionId, 1, { allowOverQuota: true });
      if (!okSeat) throw new Error("ช่วงเวลาที่เลือกไม่ถูกต้อง");
    }

    if (toRemove.length > 0) {
      await tx
        .delete(registrationSessions)
        .where(
          and(
            eq(registrationSessions.registrationId, input.id),
            inArray(registrationSessions.sessionId, toRemove),
          ),
        );
    }
    if (toAdd.length > 0) {
      await tx
        .insert(registrationSessions)
        .values(toAdd.map((sessionId) => ({ registrationId: input.id, sessionId })));
    }

    await tx
      .update(registrations)
      .set({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: nextEmail,
        phone: phone.data ?? input.phone,
        occupation: input.occupation?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, input.id));

    await tx
      .update(tickets)
      .set({
        holderFirstName: input.firstName.trim(),
        holderLastName: input.lastName.trim(),
        holderEmail: nextEmail,
        updatedAt: new Date(),
      })
      .where(eq(tickets.registrationId, input.id));

    return { added: toAdd.length, removed: toRemove.length };
  });

  await recordAudit({
    userId: admin.id,
    action: "update",
    entityType: "registration",
    entityId: input.id,
    before: {
      firstName: before.firstName,
      lastName: before.lastName,
      email: before.email,
      phone: before.phone,
      occupation: before.occupation,
    },
    after: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: nextEmail,
      phone: phone.data,
      occupation: input.occupation?.trim() || null,
      sessionsAdded: result.added,
      sessionsRemoved: result.removed,
    },
  });

  revalidatePath(`/admin/registrations/${input.id}`);
  revalidatePath("/admin/registrations");
  return { ok: true, message: "บันทึกการแก้ไขเรียบร้อย" };
}

/* ------------------------------------------------------------------ */
/* ส่งอีเมลซ้ำ                                                          */
/* ------------------------------------------------------------------ */

export async function resendEmailsAction(ids: string[]): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };
  if (ids.length === 0) return { ok: false, message: "ยังไม่ได้เลือกรายการ" };

  let sent = 0;
  let failed = 0;

  for (const id of ids) {
    const result = await sendConfirmationEmail(id);
    if (result?.sent) sent += 1;
    else failed += 1;
  }

  await recordAudit({
    userId: admin.id,
    action: "resend_email",
    entityType: "registration",
    entityId: ids.length === 1 ? (ids[0] ?? null) : null,
    after: { count: ids.length, sent, failed },
  });

  revalidatePath("/admin/emails");
  revalidatePath("/admin/registrations");

  if (failed === 0) return { ok: true, message: `ส่งอีเมลซ้ำสำเร็จ ${sent} ฉบับ` };
  return {
    ok: sent > 0,
    message:
      sent > 0
        ? `ส่งสำเร็จ ${sent} ฉบับ · ไม่สำเร็จ ${failed} ฉบับ — ดูสาเหตุที่หน้าจัดการอีเมล`
        : "ส่งไม่สำเร็จทั้งหมด — ตรวจการตั้งค่า RESEND_API_KEY และ DNS ของโดเมนผู้ส่ง",
  };
}

/* ------------------------------------------------------------------ */
/* เพิ่มผู้ลงทะเบียนด้วยมือ (แขก VIP · ลงทะเบียนทางโทรศัพท์)             */
/* ------------------------------------------------------------------ */

export async function createRegistrationAction(input: {
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupation?: string;
  sessionIds: string[];
  sendEmail: boolean;
}): Promise<ActionResult & { registrationId?: string }> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const fieldErrors: Record<string, string> = {};
  const first = nameSchema.safeParse(input.firstName);
  if (!first.success) fieldErrors.firstName = first.error.issues[0]?.message ?? "โปรดระบุ";
  const last = nameSchema.safeParse(input.lastName);
  if (!last.success) fieldErrors.lastName = last.error.issues[0]?.message ?? "โปรดระบุ";
  const email = emailSchema.safeParse(input.email);
  if (!email.success) fieldErrors.email = email.error.issues[0]?.message ?? "โปรดระบุ";
  const phone = phoneSchema.safeParse(input.phone);
  if (!phone.success) fieldErrors.phone = phone.error.issues[0]?.message ?? "โปรดระบุ";
  if (input.sessionIds.length === 0) fieldErrors.sessionIds = "โปรดเลือกอย่างน้อย 1 ช่วงเวลา";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "ข้อมูลยังไม่ถูกต้อง", fieldErrors };
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(eq(registrations.eventId, input.eventId), eq(registrations.email, normalizedEmail)),
    );
  if (existing.length > 0) {
    return {
      ok: false,
      message: "อีเมลนี้ลงทะเบียนไว้แล้ว",
      fieldErrors: { email: "อีเมลนี้ลงทะเบียนไว้แล้วในงานนี้" },
    };
  }

  const registrationCode = generateRegistrationCode();
  const ticketCode = generateTicketCode(registrationCode);

  const created = await db.transaction(async (tx) => {
    for (const sessionId of [...input.sessionIds].sort()) {
      const okSeat = await adjustReservedCount(tx, sessionId, 1, { allowOverQuota: true });
      if (!okSeat) throw new Error("ช่วงเวลาที่เลือกไม่ถูกต้อง");
    }

    const [registration] = await tx
      .insert(registrations)
      .values({
        eventId: input.eventId,
        registrationCode,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: normalizedEmail,
        phone: phone.data ?? input.phone,
        occupation: input.occupation?.trim() || null,
        status: "confirmed",
        source: "admin_manual",
        locale: "th",
      })
      .returning({ id: registrations.id });

    if (!registration) throw new Error("บันทึกผู้ลงทะเบียนไม่สำเร็จ");

    await tx
      .insert(registrationSessions)
      .values(input.sessionIds.map((sessionId) => ({ registrationId: registration.id, sessionId })));

    await tx.insert(tickets).values({
      registrationId: registration.id,
      ticketCode,
      holderFirstName: input.firstName.trim(),
      holderLastName: input.lastName.trim(),
      holderEmail: normalizedEmail,
    });

    /**
     * บันทึกความยินยอมไว้ด้วย แต่ระบุชัดว่าเป็นการรับแจ้งทางโทรศัพท์
     * ⚠️ ผู้ดูแลต้องอ่านข้อความ PDPA ให้ผู้ลงทะเบียนฟังก่อนกดบันทึกจริง
     */
    const [ev] = await tx
      .select({ version: sql<string>`e.privacy_policy_version` })
      .from(sql`events e`)
      .where(sql`e.id = ${input.eventId}`);

    await tx.insert(consents).values({
      registrationId: registration.id,
      type: "pdpa",
      isGranted: true,
      policyVersion: ev?.version ?? "1.0",
    });

    return registration.id;
  });

  await recordAudit({
    userId: admin.id,
    action: "create",
    entityType: "registration",
    entityId: created,
    after: { email: normalizedEmail, source: "admin_manual" },
  });

  if (input.sendEmail) await sendConfirmationEmail(created);

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `เพิ่มผู้ลงทะเบียนเรียบร้อย รหัส ${registrationCode}`,
    registrationId: created,
  };
}

/* ------------------------------------------------------------------ */
/* ลบข้อมูลส่วนบุคคลตามคำขอ PDPA                                        */
/* ------------------------------------------------------------------ */

/**
 * ลบข้อมูลส่วนบุคคลแต่เก็บสถิติไว้ (หัวข้อ 3.7)
 *
 * ไม่ลบทั้งแถว เพราะจะทำให้รายงานย้อนหลังเพี้ยนทั้งหมด
 * แทนที่ด้วยค่าที่ระบุตัวบุคคลไม่ได้ แต่ยังนับเป็น 1 คนในกราฟเหมือนเดิม
 *
 * ⚠️ การกระทำนี้ย้อนกลับไม่ได้
 */
export async function anonymizeRegistrationAction(id: string): Promise<ActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const [before] = await db.select().from(registrations).where(eq(registrations.id, id));
  if (!before) return { ok: false, message: "ไม่พบรายการนี้" };

  await db.transaction(async (tx) => {
    await tx
      .update(registrations)
      .set({
        firstName: "ผู้ลงทะเบียน",
        lastName: `#${before.registrationCode}`,
        email: `deleted+${before.registrationCode.toLowerCase()}@invalid.local`,
        phone: "0000000000",
        ipHash: null,
        userAgent: null,
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, id));

    await tx
      .update(tickets)
      .set({
        holderFirstName: "ผู้ลงทะเบียน",
        holderLastName: `#${before.registrationCode}`,
        holderEmail: `deleted+${before.registrationCode.toLowerCase()}@invalid.local`,
        updatedAt: new Date(),
      })
      .where(eq(tickets.registrationId, id));
  });

  await recordAudit({
    userId: admin.id,
    action: "anonymize",
    entityType: "registration",
    entityId: id,
    // เก็บเฉพาะรหัสลงทะเบียนไว้พิสูจน์ว่าทำตามคำขอจริง ไม่เก็บชื่อหรืออีเมลเดิมซ้ำใน log
    after: { registrationCode: before.registrationCode },
  });

  revalidatePath("/admin/registrations");
  return { ok: true, message: "ลบข้อมูลส่วนบุคคลเรียบร้อย สถิติในรายงานยังคงเดิม" };
}

/** ใช้ในหน้ารายละเอียดเพื่อโหลดช่วงเวลาทั้งหมดของงาน */
export async function listEventSessions(eventId: string) {
  return db
    .select({ id: eventSessions.id, nameTh: eventSessions.nameTh })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId))
    .orderBy(eventSessions.sortOrder);
}
