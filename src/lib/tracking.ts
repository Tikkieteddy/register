import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { linkEvents, shareLinks } from "@/db/schema";
import { hashIdentifier } from "./hash";

/**
 * บันทึกเหตุการณ์ที่เกิดกับลิงก์ ตามหัวข้อ 8.5
 *
 * ⚠️ ข้อกำหนด PDPA: IP และรหัสผู้เข้าชมถูกแฮชก่อนบันทึกเสมอ
 *    ห้ามเขียนค่าดิบลงฐานข้อมูล
 */
export type LinkAction = "click" | "view_form" | "share" | "copy_link";

export type TrackParams = {
  eventId: string;
  action: LinkAction;
  shareLinkId?: string | null;
  platform?: string | null;
  sourcePage?: string | null;
  sharerRegistrationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  country?: string | null;
};

/** แยกชนิดอุปกรณ์แบบหยาบ ๆ พอสำหรับทำกราฟ ไม่ได้ทำ fingerprint */
function detectDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * บันทึกเหตุการณ์ — ออกแบบให้ "ห้ามล้มแล้วทำให้ผู้ใช้เสียประสบการณ์"
 * ถ้าบันทึกไม่สำเร็จ จะกลืน error แล้วปล่อยให้ผู้ใช้ไปต่อได้ตามปกติ
 */
export async function trackLinkEvent(params: TrackParams): Promise<void> {
  try {
    const ipHash = params.ip ? hashIdentifier(params.ip) : null;
    // รหัสผู้เข้าชมไม่ซ้ำ = แฮชของ IP รวมกับ user agent — ไม่สามารถย้อนกลับเป็นตัวบุคคลได้
    const visitorHash =
      params.ip && params.userAgent ? hashIdentifier(`${params.ip}|${params.userAgent}`) : null;

    await db.insert(linkEvents).values({
      eventId: params.eventId,
      shareLinkId: params.shareLinkId ?? null,
      action: params.action,
      platform: params.platform ?? null,
      sourcePage: params.sourcePage ?? null,
      sharerRegistrationId: params.sharerRegistrationId ?? null,
      visitorHash,
      referrer: params.referrer ?? null,
      userAgent: params.userAgent ?? null,
      deviceType: detectDevice(params.userAgent),
      country: params.country ?? null,
      ipHash,
    });

    // อัปเดตตัวนับสะสมบน share_links เพื่อให้ Dashboard อ่านเร็ว
    if (params.shareLinkId && params.action === "click") {
      await db
        .update(shareLinks)
        .set({ clickCount: sql`${shareLinks.clickCount} + 1`, updatedAt: new Date() })
        .where(eq(shareLinks.id, params.shareLinkId));
    }
  } catch (error) {
    // การเก็บสถิติต้องไม่ทำให้ผู้ใช้ลงทะเบียนไม่ได้
    console.error("[tracking] บันทึกเหตุการณ์ลิงก์ไม่สำเร็จ:", error);
  }
}

/** ดึง IP จริงของผู้ใช้จาก header ที่ CDN/proxy ใส่มาให้ */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
