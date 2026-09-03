import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
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
  await trackLinkEvent({
    eventId: parsed.data.eventId,
    action: parsed.data.action,
    platform: parsed.data.platform ?? null,
    sourcePage: parsed.data.sourcePage ?? null,
    shareLinkId: parsed.data.shareLinkId ?? null,
    ip: getClientIp(headers),
    userAgent: headers.get("user-agent"),
    referrer: headers.get("referer"),
    country: headers.get("cf-ipcountry"),
  });

  return NextResponse.json({ ok: true });
}
