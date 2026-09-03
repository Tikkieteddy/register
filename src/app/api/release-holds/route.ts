import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { releaseHold } from "@/lib/quota";

/**
 * คืนที่นั่งเมื่อผู้ใช้ปิดหน้าเว็บระหว่างกรอกฟอร์ม
 *
 * เรียกผ่าน navigator.sendBeacon ซึ่งยิงได้แม้หน้ากำลังถูกปิด
 * ถ้ายิงไม่ทัน ที่นั่งก็จะถูกคืนอัตโนมัติอยู่ดีเมื่อหมดอายุ 15 นาที
 */
const bodySchema = z.object({ tokens: z.array(z.string().uuid()).max(10) });

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  let released = 0;
  for (const token of parsed.data.tokens) {
    if (await releaseHold(db, token)) released++;
  }

  return NextResponse.json({ ok: true, released });
}
