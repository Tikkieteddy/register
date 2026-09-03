import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getShareLinkByCode } from "@/db/queries";
import { getClientIp, trackLinkEvent } from "@/lib/tracking";

/**
 * ลิงก์สั้นสำหรับติดตามผล เช่น /r/fb01 → หน้ารายละเอียดงาน
 *
 * ตามหัวข้อ 8.5 — ทุกคลิกถูกบันทึกไว้เพื่อคำนวณอัตราแปลงรายช่องทาง
 * ⚠️ ข้อมูลนี้เก็บย้อนหลังไม่ได้ ต้องสร้างลิงก์ก่อนเริ่มโปรโมทเสมอ
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const link = await getShareLinkByCode(code);

  // ลิงก์ไม่ถูกต้องหรือถูกปิด — ส่งไปหน้าแรกแทนการโชว์หน้า error
  // เพราะลิงก์พวกนี้อยู่ในสื่อที่แก้ไม่ได้แล้ว เช่น QR ที่ขึ้นจอทีวี
  if (!link) redirect("/");

  const headers = request.headers;
  await trackLinkEvent({
    eventId: link.eventId,
    action: "click",
    shareLinkId: link.id,
    ip: getClientIp(headers),
    userAgent: headers.get("user-agent"),
    referrer: headers.get("referer"),
    country: headers.get("cf-ipcountry"),
  });

  // แนบ UTM ต่อท้ายเพื่อให้เครื่องมือวิเคราะห์ภายนอกอ่านได้ด้วย
  const target = new URL(link.targetPath, request.nextUrl.origin);
  if (link.channel) target.searchParams.set("utm_source", link.channel);
  if (link.medium) target.searchParams.set("utm_medium", link.medium);
  if (link.campaign) target.searchParams.set("utm_campaign", link.campaign);
  target.searchParams.set("ref", link.code);

  redirect(target.toString());
}
