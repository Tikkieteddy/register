"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";

export type LinkResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

/**
 * จัดการลิงก์ติดตามผล (หัวข้อ 8.5)
 *
 * ⚠️ ต้องสร้างลิงก์ก่อนเริ่มโปรโมททุกครั้ง
 *    ยอดคลิกและที่มาของผู้ลงทะเบียนเก็บย้อนหลังไม่ได้
 *    ถ้าโปรโมทไปแล้วค่อยมาสร้าง จะไม่มีทางรู้ว่าคนมาจากช่องทางไหน
 */

/** อนุญาตเฉพาะตัวอักษรที่พิมพ์ตามคำบอกทางโทรศัพท์ได้ และไม่ต้อง encode ใน URL */
const CODE_PATTERN = /^[a-z0-9-]{2,20}$/;

export async function saveShareLinkAction(input: {
  id?: string;
  eventId: string;
  code: string;
  label: string;
  channel: string;
  medium: string;
  campaign: string;
  isActive: boolean;
}): Promise<LinkResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const code = input.code.trim().toLowerCase();
  const fieldErrors: Record<string, string> = {};

  if (!CODE_PATTERN.test(code)) {
    fieldErrors.code = "ใช้ได้เฉพาะ a-z 0-9 และขีดกลาง ความยาว 2–20 ตัว";
  }
  if (!input.label.trim()) {
    fieldErrors.label = "โปรดระบุชื่อที่สื่อว่าลิงก์นี้ใช้กับอะไร";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "ข้อมูลยังไม่ถูกต้อง", fieldErrors };
  }

  const clash = await db
    .select({ id: shareLinks.id })
    .from(shareLinks)
    .where(input.id ? and(eq(shareLinks.code, code), ne(shareLinks.id, input.id)) : eq(shareLinks.code, code));

  if (clash.length > 0) {
    return {
      ok: false,
      message: "รหัสลิงก์นี้ถูกใช้ไปแล้ว",
      fieldErrors: { code: "รหัสนี้ซ้ำกับลิงก์อื่น" },
    };
  }

  const values = {
    eventId: input.eventId,
    code,
    label: input.label.trim(),
    channel: input.channel.trim() || null,
    medium: input.medium.trim() || null,
    campaign: input.campaign.trim() || null,
    isActive: input.isActive,
    updatedAt: new Date(),
  };

  if (input.id) {
    const [before] = await db.select().from(shareLinks).where(eq(shareLinks.id, input.id));
    await db.update(shareLinks).set(values).where(eq(shareLinks.id, input.id));
    await recordAudit({
      userId: admin.id,
      action: "update_link",
      entityType: "share_link",
      entityId: input.id,
      before: before ? { code: before.code, label: before.label, isActive: before.isActive } : null,
      after: { code, label: values.label, isActive: values.isActive },
    });
  } else {
    const [created] = await db
      .insert(shareLinks)
      .values({ ...values, createdBy: admin.id })
      .returning({ id: shareLinks.id });
    await recordAudit({
      userId: admin.id,
      action: "create_link",
      entityType: "share_link",
      entityId: created?.id ?? null,
      after: { code, label: values.label },
    });
  }

  revalidatePath("/admin/links");
  revalidatePath("/admin");
  return { ok: true, message: input.id ? "บันทึกลิงก์เรียบร้อย" : `สร้างลิงก์ /r/${code} เรียบร้อย` };
}

/**
 * ปิดลิงก์โดยไม่ลบ — รักษาสถิติเดิมไว้
 *
 * ⚠️ ห้ามทำปุ่มลบลิงก์ เพราะการลบจะทำให้ผู้ลงทะเบียนที่มาจากลิงก์นั้น
 *    กลายเป็น "ไม่ทราบที่มา" ทั้งหมด และรายงานย้อนหลังจะเพี้ยน
 */
export async function toggleShareLinkAction(id: string, isActive: boolean): Promise<LinkResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  await db
    .update(shareLinks)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(shareLinks.id, id));

  await recordAudit({
    userId: admin.id,
    action: "update_link",
    entityType: "share_link",
    entityId: id,
    after: { isActive },
  });

  revalidatePath("/admin/links");
  return { ok: true, message: isActive ? "เปิดใช้งานลิงก์แล้ว" : "ปิดลิงก์แล้ว สถิติเดิมยังอยู่ครบ" };
}
