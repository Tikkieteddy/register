/**
 * เรนเดอร์อีเมลยืนยันของผู้ลงทะเบียนคนล่าสุดออกมาเป็นไฟล์ HTML
 * ไว้ตรวจหน้าตาอีเมลโดยไม่ต้องส่งจริง
 *
 * รันด้วย: npx tsx scripts/preview-email.ts preview.html
 */
import { writeFileSync } from "node:fs";
import { db } from "@/db";
import { registrations } from "@/db/schema";
import { calendarEventFromTicket } from "@/lib/email/confirmation";
import { confirmationHtml, confirmationSubject, confirmationText } from "@/lib/email/templates";
import { googleCalendarUrl } from "@/lib/calendar";
import { qrDataUrl } from "@/lib/qr";
import { getTicketByRegistrationId } from "@/lib/ticket";

async function main() {
  const [reg] = await db.select({ id: registrations.id }).from(registrations).limit(1);
  if (!reg) throw new Error("ไม่พบผู้ลงทะเบียน");
  const ticket = await getTicketByRegistrationId(reg.id);
  if (!ticket) throw new Error("ไม่พบตั๋ว");

  const data = {
    firstName: ticket.firstName, lastName: ticket.lastName,
    registrationCode: ticket.registrationCode, ticketCode: ticket.ticketCode,
    eventName: ticket.event.nameTh,
    sessions: ticket.sessions.map((s) => ({ nameTh: s.nameTh, startsAt: s.startsAt, endsAt: s.endsAt })),
    eventStartsAt: ticket.event.startsAt, eventEndsAt: ticket.event.endsAt,
    venueName: ticket.event.venueName ?? "-", venueAddress: ticket.event.venueAddress ?? "-",
    mapUrl: ticket.event.mapUrl, travelNote: ticket.event.travelNote,
    organizerName: ticket.event.organizerName ?? "", organizerPhone: ticket.event.organizerPhone,
    organizerEmail: ticket.event.organizerEmail,
    qrImageUrl: await qrDataUrl(ticket.qrToken, 400),
    ticketUrl: `http://localhost:3100/ticket/${ticket.qrToken}`,
    calendarUrl: googleCalendarUrl(calendarEventFromTicket(ticket)),
    cancelUrl: "http://localhost:3100/cancel", privacyUrl: "http://localhost:3100/privacy",
  };

  const outputPath = process.argv[2] ?? "email-preview.html";
  writeFileSync(outputPath, confirmationHtml(data));
  console.log("บันทึกไฟล์ที่:", outputPath);
  console.log("หัวข้อ:", confirmationSubject(data));
  console.log("ความยาว HTML:", confirmationHtml(data).length, "ตัวอักษร");
  console.log("plain-text บรรทัดแรก:", confirmationText(data).split("\n")[0]);
  process.exit(0);

}

main().catch((e: unknown) => { console.error(e); process.exit(1); });
