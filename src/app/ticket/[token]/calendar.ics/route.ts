import { NextResponse } from "next/server";
import { icsFromTicket } from "@/lib/email/confirmation";
import { getTicketByToken } from "@/lib/ticket";

/**
 * ไฟล์ปฏิทิน .ics สำหรับ Apple Calendar / Outlook และปฏิทินอื่น
 * ส่วน Google Calendar ใช้ลิงก์ตรงแทน (ระดับ 1 ตามคำตอบ Q21)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ticket = await getTicketByToken(token);
  if (!ticket) return new NextResponse("ไม่พบตั๋ว", { status: 404 });

  return new NextResponse(icsFromTicket(ticket), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ticket.registrationCode}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
