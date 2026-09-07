import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { releaseAllExpiredHolds, releaseHold } from "@/lib/quota";

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

/**
 * กวาดที่นั่งที่จองค้างหมดอายุทั้งหมด — เรียกโดย Vercel Cron วันละครั้ง
 *
 * ⚠️ นี่เป็นแค่ตาข่ายรองรับ ไม่ใช่กลไกหลัก
 *    กลไกหลักคือการคืนที่นั่งแบบทันทีที่มีคนต้องการใช้ ซึ่งอยู่ใน holdSeat()
 *    (จำเป็นเพราะ Vercel แพ็กเกจฟรีรัน cron ได้แค่วันละครั้ง ซึ่งช้าเกินไปสำหรับที่นั่ง)
 *    งานของ cron นี้คือเก็บกวาดแถวที่ค้างในตาราง seat_holds ไม่ให้พอกพูน
 *
 * ป้องกันการเรียกจากภายนอกด้วย CRON_SECRET ที่ Vercel แนบมาในส่วนหัว Authorization
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // ถ้าไม่ได้ตั้ง CRON_SECRET ไว้ ให้ปฏิเสธทุกคำขอ ปลอดภัยกว่าเปิดทิ้งไว้
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "ยังไม่ได้ตั้งค่า CRON_SECRET" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const released = await releaseAllExpiredHolds(db);
  return NextResponse.json({ ok: true, released });
}
