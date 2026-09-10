import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isEventPublic } from "@/db/queries";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { getClientIp, trackLinkEvent } from "@/lib/tracking";

/** รับการแจ้งเหตุการณ์จากฝั่งเบราว์เซอร์ เช่น การกดปุ่มแชร์ */
const bodySchema = z.object({
  eventId: z.string().uuid(),
  action: z.enum(["share", "copy_link", "view_form"]),
  platform: z.string().max(40).optional(),
  sourcePage: z.enum(["landing", "thankyou"]).optional(),
  shareLinkId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const headers = request.headers;
  const ip = getClientIp(headers);

  /**
   * ⚠️ ปลายทางนี้เปิดให้ยิงเข้ามาได้โดยไม่ต้องล็อกอิน จึงต้องกันสองอย่าง
   *
   * ① จำกัดจำนวนครั้งต่อที่อยู่เครือข่าย — ไม่งั้นตัวเลขในหน้ารายงานถูกปั่นได้
   *    และตาราง link_events จะโตขึ้นเรื่อย ๆ จนกินโควตาฐานข้อมูล
   * ② eventId ต้องเป็นงานที่เผยแพร่แล้วจริง ไม่ใช่ id ที่ยัดมั่วมา
   *
   * ตอบ ok กลับไปเสมอแม้จะไม่ได้บันทึก เพราะฝั่งหน้าเว็บไม่ควรต้องรับรู้
   * และการเก็บสถิติต้องไม่ทำให้ผู้ใช้เห็นข้อความ error
   */
  if (ip) {
    const limit = await checkRateLimit(
      rateLimitKey("track", ip),
      RATE_LIMITS.track.limit,
      RATE_LIMITS.track.windowSeconds,
    );
    if (!limit.allowed) return NextResponse.json({ ok: true });
  }

  if (!(await isEventPublic(parsed.data.eventId))) {
    return NextResponse.json({ ok: true });
  }

  await trackLinkEvent({
    eventId: parsed.data.eventId,
    action: parsed.data.action,
    platform: parsed.data.platform ?? null,
    sourcePage: parsed.data.sourcePage ?? null,
    shareLinkId: parsed.data.shareLinkId ?? null,
    ip,
    userAgent: headers.get("user-agent"),
    referrer: headers.get("referer"),
    country: headers.get("cf-ipcountry"),
  });

  return NextResponse.json({ ok: true });
}
