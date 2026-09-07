import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { getAdminOrNull } from "@/lib/admin/guard";
import { clientEnv } from "@/lib/env";
import { qrPngBuffer, qrSvg } from "@/lib/qr";

/**
 * ดาวน์โหลด QR ของลิงก์ติดตามผล (หัวข้อ 8.5)
 *
 * รองรับทั้ง PNG (ใช้บนสไลด์และจอทีวี) และ SVG (ใช้กับงานพิมพ์
 * เพราะขยายเท่าไรก็ยังคม ไม่แตกเหมือน PNG)
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์ใช้งานส่วนนี้" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  if (!id) return NextResponse.json({ ok: false, message: "ไม่พบลิงก์" }, { status: 400 });

  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.id, id));
  if (!link) return NextResponse.json({ ok: false, message: "ไม่พบลิงก์" }, { status: 404 });

  const url = `${clientEnv.NEXT_PUBLIC_SITE_URL}/r/${link.code}`;
  const format = params.get("format") === "svg" ? "svg" : "png";
  const encodedName = encodeURIComponent(`QR-${link.code}.${format}`);

  if (format === "svg") {
    const svg = await qrSvg(url);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      },
    });
  }

  // 1024 px กว้างพอสำหรับพิมพ์ขนาด A4 ที่ 300 DPI โดยไม่แตก
  const png = await qrPngBuffer(url, 1024);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    },
  });
}
