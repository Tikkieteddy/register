import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { hashIdentifier } from "@/lib/hash";
import { getClientIp } from "@/lib/tracking";

/**
 * บันทึกร่องรอยการเข้าถึงและแก้ไขข้อมูล (ข้อกำหนด PDPA)
 *
 * ⚠️ ทุกการกระทำในหลังบ้านที่แตะข้อมูลส่วนบุคคล **ต้อง** เรียกฟังก์ชันนี้
 *    โดยเฉพาะการ export ซึ่งกฎหมายกำหนดให้ต้องรู้ว่า
 *    ใคร ดึงอะไรออกไป เมื่อไร กี่รายการ
 *
 * ⚠️ IP ถูกแฮชก่อนบันทึกเสมอ ห้ามเขียนค่าดิบลงฐานข้อมูล
 *
 * ออกแบบให้ "ห้ามล้มแล้วทำให้งานหลักพัง" — ถ้าบันทึกไม่สำเร็จจะกลืน error
 * เพราะการที่ Admin แก้ข้อมูลไม่ได้เพราะเขียน log ไม่ลง เสียหายมากกว่า
 */
export type AuditAction =
  | "login"
  | "logout"
  | "view_list"
  | "view_detail"
  | "export"
  | "create"
  | "update"
  | "cancel"
  | "delete"
  | "anonymize"
  | "resend_email"
  | "test_email"
  | "upload_media"
  | "delete_media"
  | "create_link"
  | "update_link"
  | "update_settings"
  | "create_user"
  | "update_user"
  | "reset_password";

export async function recordAudit(params: {
  userId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const h = await headers();
    const ip = getClientIp(h);

    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      beforeJson: (params.before ?? null) as never,
      afterJson: (params.after ?? null) as never,
      ipHash: ip ? hashIdentifier(ip) : null,
    });
  } catch (error) {
    console.error("บันทึก audit log ไม่สำเร็จ", error);
  }
}

/**
 * เก็บเฉพาะฟิลด์ที่สนใจลง before/after
 * ไม่เก็บทั้งแถวเพราะจะทำให้ audit log บวมและมีข้อมูลส่วนบุคคลซ้ำซ้อนโดยไม่จำเป็น
 */
export function pickFields<T extends object, K extends keyof T>(row: T, keys: readonly K[]) {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) out[key] = row[key];
  return out;
}
