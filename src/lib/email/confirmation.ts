import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";
import { clientEnv } from "@/lib/env";
import { qrDataUrl, qrPngBuffer } from "@/lib/qr";
import { getTicketByRegistrationId, ticketTimeRange, type TicketView } from "@/lib/ticket";
import { sendWithRetry } from "./sender";
import { confirmationHtml, confirmationSubject, confirmationText } from "./templates";

/** สร้างข้อมูลนัดในปฏิทินจากตั๋ว — ใช้ช่วงเวลาที่ผู้ลงทะเบียนเลือกจริง */
export function calendarEventFromTicket(ticket: TicketView): CalendarEvent {
  const { startsAt, endsAt } = ticketTimeRange(ticket);
  const venue = [ticket.event.venueName, ticket.event.venueAddress].filter(Boolean).join(" ");
  return {
    title: ticket.event.nameTh,
    description: `รหัสผู้ลงทะเบียน ${ticket.registrationCode}`,
    location: venue,
    startsAt,
    endsAt,
    url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/ticket/${ticket.qrToken}`,
    uid: `${ticket.qrToken}@event-registration`,
  };
}

export function icsFromTicket(ticket: TicketView): string {
  return buildIcs(calendarEventFromTicket(ticket));
}

/**
 * ส่งอีเมลยืนยันการลงทะเบียน
 *
 * เรียกแบบไม่ await จาก submit action เพื่อให้ผู้ใช้เห็นหน้าเสร็จสิ้นทันที
 * ตามหัวข้อ 8.2 — ผู้ใช้ได้ตั๋วแล้วโดยไม่ต้องรออีเมล
 */
export async function sendConfirmationEmail(
  registrationId: string,
): Promise<{ sent: boolean; logId: number } | null> {
  const ticket = await getTicketByRegistrationId(registrationId);
  if (!ticket) return null;

  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const [qrDataUri, qrPng] = await Promise.all([
    qrDataUrl(ticket.qrToken, 400),
    qrPngBuffer(ticket.qrToken, 512),
  ]);

  const data = {
    firstName: ticket.firstName,
    lastName: ticket.lastName,
    registrationCode: ticket.registrationCode,
    ticketCode: ticket.ticketCode,
    eventName: ticket.event.nameTh,
    sessions: ticket.sessions.map((s) => ({
      nameTh: s.nameTh,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    })),
    eventStartsAt: ticket.event.startsAt,
    eventEndsAt: ticket.event.endsAt,
    venueName: ticket.event.venueName ?? "-",
    venueAddress: ticket.event.venueAddress ?? "-",
    mapUrl: ticket.event.mapUrl,
    travelNote: ticket.event.travelNote,
    organizerName: ticket.event.organizerName ?? ticket.event.nameTh,
    organizerPhone: ticket.event.organizerPhone,
    organizerEmail: ticket.event.organizerEmail,
    /**
     * ฝัง QR เป็น data URI ในอีเมล และแนบไฟล์ PNG ไปด้วย
     * เผื่อโปรแกรมอีเมลบล็อกการโหลดรูป ตามข้อกำหนด A2
     */
    qrImageUrl: qrDataUri,
    ticketUrl: `${site}/ticket/${ticket.qrToken}`,
    calendarUrl: googleCalendarUrl(calendarEventFromTicket(ticket)),
    cancelUrl: `${site}/ticket/${ticket.qrToken}/cancel`,
    privacyUrl: `${site}/privacy`,
  };

  return sendWithRetry({
    registrationId,
    template: "registration_confirmation",
    message: {
      to: ticket.email,
      subject: confirmationSubject(data),
      html: confirmationHtml(data),
      text: confirmationText(data),
      attachments: [
        { filename: `qr-${ticket.registrationCode}.png`, content: qrPng, contentType: "image/png" },
        {
          filename: `${ticket.registrationCode}.ics`,
          content: Buffer.from(icsFromTicket(ticket), "utf-8"),
          contentType: "text/calendar",
        },
      ],
    },
  });
}
