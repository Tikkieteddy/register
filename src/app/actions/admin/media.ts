"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  processAndUpload,
} from "@/lib/admin/media";
import { MEDIA_TYPES, type MediaType } from "@/lib/admin/media-types";
import { recordAudit } from "@/lib/audit";

export type MediaResult = { ok: boolean; message: string; warnings?: string[] };

function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value);
}

/**
 * อัปโหลดภาพเข้า Media Manager (หัวข้อ 8.4)
 *
 * ⚠️ ความปลอดภัย — ตรวจ 3 ชั้นก่อนรับไฟล์:
 *    ① ชนิดไฟล์ต้องอยู่ในรายการที่อนุญาต
 *    ② ขนาดต้องไม่เกินที่กำหนด
 *    ③ ภาพทุกไฟล์ถูกอ่านและเขียนใหม่ด้วย sharp (หรือกรองแท็กสำหรับ SVG)
 *       ไฟล์ที่ผู้ใช้ส่งมาจะไม่ถูกเก็บดิบ ๆ เด็ดขาด
 */
export async function uploadMediaAction(formData: FormData): Promise<MediaResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const eventId = String(formData.get("eventId") ?? "");
  const rawType = String(formData.get("type") ?? "");
  const file = formData.get("file");

  if (!eventId) return { ok: false, message: "ไม่พบงาน" };
  if (!isMediaType(rawType)) return { ok: false, message: "ประเภทภาพไม่ถูกต้อง" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "ยังไม่ได้เลือกไฟล์" };
  }

  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: `ชนิดไฟล์ ${file.type || "ที่เลือก"} ใช้ไม่ได้ — รองรับเฉพาะ JPG · PNG · WebP · SVG`,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `ไฟล์ใหญ่ ${Math.round(file.size / 1024 / 1024)} MB เกินขีดจำกัด ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB — กรุณาย่อภาพก่อนอัปโหลด`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let processed;
  try {
    processed = await processAndUpload({
      eventId,
      type: rawType,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
  } catch (error) {
    console.error("ประมวลผลภาพไม่สำเร็จ", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? `อัปโหลดไม่สำเร็จ: ${error.message}`
          : "อัปโหลดไม่สำเร็จ — ไฟล์อาจเสียหายหรือไม่ใช่ภาพจริง",
    };
  }

  // เอาลำดับสูงสุดที่มีอยู่ เพื่อให้ภาพใหม่ไปต่อท้ายเสมอ
  const [last] = await db
    .select({ sortOrder: mediaAssets.sortOrder })
    .from(mediaAssets)
    .where(eq(mediaAssets.eventId, eventId))
    .orderBy(desc(mediaAssets.sortOrder))
    .limit(1);

  const [created] = await db
    .insert(mediaAssets)
    .values({
      eventId,
      type: rawType,
      originalUrl: processed.originalUrl,
      webpUrl: processed.webpUrl,
      avifUrl: processed.avifUrl,
      variants: processed.variants as never,
      mimeType: processed.mimeType,
      width: processed.width || null,
      height: processed.height || null,
      sizeBytes: processed.sizeBytes,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      uploadedBy: admin.id,
    })
    .returning({ id: mediaAssets.id });

  await recordAudit({
    userId: admin.id,
    action: "upload_media",
    entityType: "media_asset",
    entityId: created?.id ?? null,
    after: { type: rawType, sizeBytes: processed.sizeBytes, fileName: file.name },
  });

  revalidatePath("/admin/media");
  return {
    ok: true,
    message: "อัปโหลดเรียบร้อย — ระบบแปลงเป็น WebP และ AVIF พร้อมย่อหลายขนาดให้แล้ว",
    warnings: processed.warnings,
  };
}

/** บันทึกข้อความอธิบายภาพ — จำเป็นต่อคะแนน Accessibility ตามข้อกำหนด E4 */
export async function updateMediaMetaAction(input: {
  id: string;
  altTextTh: string;
  altTextEn: string;
  captionTh: string;
  sortOrder: number;
}): Promise<MediaResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  await db
    .update(mediaAssets)
    .set({
      altTextTh: input.altTextTh.trim() || null,
      altTextEn: input.altTextEn.trim() || null,
      captionTh: input.captionTh.trim() || null,
      sortOrder: input.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, input.id));

  await recordAudit({
    userId: admin.id,
    action: "update",
    entityType: "media_asset",
    entityId: input.id,
    after: { altTextTh: input.altTextTh, sortOrder: input.sortOrder },
  });

  revalidatePath("/admin/media");
  return { ok: true, message: "บันทึกข้อมูลภาพเรียบร้อย" };
}

export async function deleteMediaAction(id: string): Promise<MediaResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
  if (!row) return { ok: false, message: "ไม่พบภาพนี้" };

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

  /**
   * ตั้งใจไม่ลบไฟล์จริงออกจากที่เก็บ
   * เพราะภาพอาจถูกอ้างถึงในอีเมลที่ส่งออกไปแล้ว ซึ่งเรียกกลับไม่ได้
   * ถ้าลบไฟล์ อีเมลเก่าจะกลายเป็นภาพเสียทั้งหมด
   */
  await recordAudit({
    userId: admin.id,
    action: "delete_media",
    entityType: "media_asset",
    entityId: id,
    before: { type: row.type, originalUrl: row.originalUrl },
  });

  revalidatePath("/admin/media");
  return {
    ok: true,
    message: "นำภาพออกจากระบบแล้ว (ไฟล์ยังอยู่ในที่เก็บ เผื่ออีเมลเก่าที่ส่งไปแล้วอ้างถึงอยู่)",
  };
}
