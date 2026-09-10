"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { eventSessions, events, users } from "@/db/schema";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/auth/password";
import { pickFields, recordAudit } from "@/lib/audit";

export type SettingsResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

/* ------------------------------------------------------------------ */
/* แท็บ "ข้อมูลงาน"                                                    */
/* ------------------------------------------------------------------ */

export async function updateEventInfoAction(input: {
  id: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  travelNote: string;
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  organizerLineId: string;
}): Promise<SettingsResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  if (!input.nameTh.trim()) {
    return { ok: false, message: "ข้อมูลยังไม่ครบ", fieldErrors: { nameTh: "โปรดระบุชื่องาน" } };
  }

  const [before] = await db.select().from(events).where(eq(events.id, input.id));
  if (!before) return { ok: false, message: "ไม่พบงาน" };

  await db
    .update(events)
    .set({
      nameTh: input.nameTh.trim(),
      nameEn: input.nameEn.trim() || null,
      descriptionTh: input.descriptionTh.trim() || null,
      venueName: input.venueName.trim() || null,
      venueAddress: input.venueAddress.trim() || null,
      mapUrl: input.mapUrl.trim() || null,
      travelNote: input.travelNote.trim() || null,
      organizerName: input.organizerName.trim() || null,
      organizerPhone: input.organizerPhone.trim() || null,
      organizerEmail: input.organizerEmail.trim() || null,
      organizerLineId: input.organizerLineId.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, input.id));

  await recordAudit({
    userId: admin.id,
    action: "update_settings",
    entityType: "event",
    entityId: input.id,
    before: pickFields(before, ["nameTh", "venueName", "organizerName", "organizerPhone"]),
    after: { nameTh: input.nameTh, venueName: input.venueName, organizerName: input.organizerName },
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: "บันทึกข้อมูลงานเรียบร้อย" };
}

/* ------------------------------------------------------------------ */
/* แท็บ "ที่นั่งและโควตา"                                              */
/* ------------------------------------------------------------------ */

/**
 * แก้จำนวนที่นั่งและกฎการเปิด-ปิดรับ
 *
 * ⚠️ ลดโควตาลงต่ำกว่าจำนวนที่จองไปแล้วไม่ได้
 *    ถ้าปล่อยให้ทำได้ ระบบจะกลายเป็นสถานะ "รับเกิน" ที่แก้ไม่ได้
 *    และหน้าเว็บจะแสดงที่นั่งคงเหลือเป็นค่าติดลบ
 */
export async function updateQuotaAction(input: {
  eventId: string;
  sessions: { id: string; quota: number; isClosed: boolean }[];
  seatHoldMinutes: number;
  allowWalkinOverQuota: boolean;
  waitlistEnabled: boolean;
  status: "draft" | "published" | "closed" | "archived";
  registrationOpensAt: string;
  registrationClosesAt: string;
}): Promise<SettingsResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const current = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, input.eventId));

  for (const change of input.sessions) {
    const existing = current.find((s) => s.id === change.id);
    if (!existing) continue;
    if (change.quota < existing.reservedCount) {
      return {
        ok: false,
        message:
          `ลดที่นั่งของ “${existing.nameTh}” เหลือ ${change.quota} ไม่ได้ ` +
          `เพราะมีคนจองไปแล้ว ${existing.reservedCount} ที่ — ` +
          "ถ้าต้องการลดจริง ต้องยกเลิกการลงทะเบียนบางรายการก่อน",
      };
    }
  }

  if (input.seatHoldMinutes < 5 || input.seatHoldMinutes > 60) {
    return {
      ok: false,
      message: "เวลาจองที่นั่งชั่วคราวต้องอยู่ระหว่าง 5–60 นาที",
      fieldErrors: { seatHoldMinutes: "ใส่ค่าระหว่าง 5 ถึง 60" },
    };
  }

  await db.transaction(async (tx) => {
    for (const change of input.sessions) {
      await tx
        .update(eventSessions)
        .set({ quota: change.quota, isClosed: change.isClosed, updatedAt: new Date() })
        .where(eq(eventSessions.id, change.id));
    }

    await tx
      .update(events)
      .set({
        seatHoldMinutes: input.seatHoldMinutes,
        allowWalkinOverQuota: input.allowWalkinOverQuota,
        waitlistEnabled: input.waitlistEnabled,
        status: input.status,
        registrationOpensAt: input.registrationOpensAt
          ? new Date(input.registrationOpensAt)
          : null,
        registrationClosesAt: input.registrationClosesAt
          ? new Date(input.registrationClosesAt)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, input.eventId));
  });

  await recordAudit({
    userId: admin.id,
    action: "update_settings",
    entityType: "event_quota",
    entityId: input.eventId,
    before: current.map((s) => ({ id: s.id, quota: s.quota, isClosed: s.isClosed })),
    after: input.sessions,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ok: true, message: "บันทึกการตั้งค่าที่นั่งเรียบร้อย" };
}

/* ------------------------------------------------------------------ */
/* แท็บ "ผู้ใช้งาน"                                                    */
/* ------------------------------------------------------------------ */

export async function saveUserAction(input: {
  id?: string;
  email: string;
  fullName: string;
  role: "admin" | "staff" | "viewer";
  canScan: boolean;
  isActive: boolean;
  password?: string;
}): Promise<SettingsResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const email = input.email.trim().toLowerCase();
  const fieldErrors: Record<string, string> = {};
  if (!email.includes("@")) fieldErrors.email = "อีเมลไม่ถูกต้อง";
  if (!input.fullName.trim()) fieldErrors.fullName = "โปรดระบุชื่อ";
  if (!input.id && (!input.password || input.password.length < 10)) {
    fieldErrors.password = "รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร";
  }
  if (input.password && input.password.length > 0 && input.password.length < 10) {
    fieldErrors.password = "รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "ข้อมูลยังไม่ถูกต้อง", fieldErrors };
  }

  const existing = await db.select().from(users).where(eq(users.email, email));
  const clash = existing.find((u) => u.id !== input.id);
  if (clash) {
    return { ok: false, message: "อีเมลนี้มีบัญชีอยู่แล้ว", fieldErrors: { email: "อีเมลซ้ำ" } };
  }

  if (input.id) {
    const [before] = await db.select().from(users).where(eq(users.id, input.id));
    if (!before) return { ok: false, message: "ไม่พบบัญชีนี้" };

    /**
     * ⚠️ กันไม่ให้ผู้ดูแลถอดสิทธิ์ตัวเองหรือปิดบัญชีตัวเอง
     *    ถ้าเผลอทำ จะไม่มีใครเข้าหลังบ้านได้อีกเลยจนกว่าจะแก้ในฐานข้อมูลโดยตรง
     */
    if (before.id === admin.id && (input.role !== "admin" || !input.isActive)) {
      return {
        ok: false,
        message: "ถอดสิทธิ์หรือปิดบัญชีของตัวเองไม่ได้ — ให้ผู้ดูแลคนอื่นเป็นคนแก้ให้",
      };
    }

    await db
      .update(users)
      .set({
        email,
        fullName: input.fullName.trim(),
        role: input.role,
        canScan: input.canScan,
        isActive: input.isActive,
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        // ปลดล็อกบัญชีให้ด้วยเมื่อผู้ดูแลตั้งรหัสผ่านใหม่ให้
        ...(input.password ? { failedLoginCount: 0, lockedUntil: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.id));

    await recordAudit({
      userId: admin.id,
      action: input.password ? "reset_password" : "update_user",
      entityType: "user",
      entityId: input.id,
      before: pickFields(before, ["email", "role", "canScan", "isActive"]),
      after: { email, role: input.role, canScan: input.canScan, isActive: input.isActive },
    });

    revalidatePath("/admin/settings");
    return { ok: true, message: "บันทึกบัญชีผู้ใช้เรียบร้อย" };
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      fullName: input.fullName.trim(),
      role: input.role,
      canScan: input.canScan,
      isActive: input.isActive,
      passwordHash: await hashPassword(input.password ?? ""),
    })
    .returning({ id: users.id });

  await recordAudit({
    userId: admin.id,
    action: "create_user",
    entityType: "user",
    entityId: created?.id ?? null,
    after: { email, role: input.role },
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: `สร้างบัญชี ${email} เรียบร้อย` };
}

/* ------------------------------------------------------------------ */
/* แท็บ "ความเป็นส่วนตัว"                                              */
/* ------------------------------------------------------------------ */

export async function updatePrivacyAction(input: {
  eventId: string;
  privacyPolicyVersion: string;
  /** จำนวนวันที่เก็บข้อมูลหลังงานจบ — ค่าว่างแปลว่าไม่ลบอัตโนมัติ */
  dataRetentionDays: string;
}): Promise<SettingsResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const version = input.privacyPolicyVersion.trim();
  if (!version) {
    return {
      ok: false,
      message: "โปรดระบุเวอร์ชันนโยบาย",
      fieldErrors: { privacyPolicyVersion: "โปรดระบุ" },
    };
  }

  /**
   * ระยะเวลาเก็บข้อมูล — ว่างได้ แต่ถ้าใส่ต้องเป็นจำนวนเต็มบวก
   *
   * ⚠️ ตั้งน้อยเกินไปอันตราย เพราะการลบย้อนกลับไม่ได้
   *    กันไว้ที่ 7 วันเป็นอย่างน้อย เผื่อเวลาให้ทีมส่งออกรายงานหลังงานจบก่อน
   */
  const retentionRaw = input.dataRetentionDays.trim();
  let dataRetentionDays: number | null = null;
  if (retentionRaw) {
    const parsed = Number(retentionRaw);
    if (!Number.isInteger(parsed) || parsed < 7 || parsed > 3650) {
      return {
        ok: false,
        message: "ระยะเวลาเก็บข้อมูลไม่ถูกต้อง",
        fieldErrors: { dataRetentionDays: "ต้องเป็นจำนวนเต็มระหว่าง 7 ถึง 3650 วัน" },
      };
    }
    dataRetentionDays = parsed;
  }

  await db
    .update(events)
    .set({ privacyPolicyVersion: version, dataRetentionDays, updatedAt: new Date() })
    .where(eq(events.id, input.eventId));

  await recordAudit({
    userId: admin.id,
    action: "update_settings",
    entityType: "event_privacy",
    entityId: input.eventId,
    after: { privacyPolicyVersion: version, dataRetentionDays },
  });

  revalidatePath("/admin/settings");
  return {
    ok: true,
    message:
      "บันทึกเรียบร้อย — ผู้ที่ลงทะเบียนหลังจากนี้จะถูกบันทึกว่ายินยอมตามนโยบายเวอร์ชันใหม่",
  };
}
