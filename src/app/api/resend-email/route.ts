import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { sendConfirmationEmail } from "@/lib/email/confirmation";
import { getTicketByToken } from "@/lib/ticket";

/**
 * ส่งอีเมลยืนยันซ้ำ
 *
 * ⚠️ จำกัด 3 ครั้งต่อชั่วโมงต่อการลงทะเบียน 1 รายการ
 *    กันการยิงซ้ำจนโดนผู้ให้บริการอีเมลบล็อกโดเมน
 */
const RESEND_LIMIT_PER_HOUR = 3;

const bodySchema = z.object({ qrToken: z.string().uuid() });

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const ticket = await getTicketByToken(parsed.data.qrToken);
  // ไม่บอกว่าตั๋วมีอยู่จริงหรือไม่ เพื่อกันการสุ่มเดา token
  if (!ticket || ticket.status === "cancelled") {
    return NextResponse.json({ ok: false, message: "ไม่สามารถส่งอีเมลได้" }, { status: 404 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailLogs)
    .where(
      and(
        eq(emailLogs.registrationId, ticket.registrationId),
        gte(emailLogs.createdAt, oneHourAgo),
      ),
    );

  if ((recent?.count ?? 0) >= RESEND_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { ok: false, message: "ส่งซ้ำได้สูงสุด 3 ครั้งต่อชั่วโมง กรุณาลองใหม่ภายหลัง" },
      { status: 429 },
    );
  }

  const result = await sendConfirmationEmail(ticket.registrationId);
  return NextResponse.json(
    result?.sent
      ? { ok: true }
      : { ok: false, message: "ส่งไม่สำเร็จ กรุณาติดต่อผู้จัดงาน" },
    { status: result?.sent ? 200 : 502 },
  );
}
