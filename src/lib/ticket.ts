import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  eventSessions,
  events,
  registrationSessions,
  registrations,
  tickets,
} from "@/db/schema";

/**
 * ข้อมูลตั๋วครบชุด — ใช้ร่วมกันทั้งหน้าเสร็จสิ้น หน้าบัตรออนไลน์
 * หน้าพิมพ์ตั๋ว ไฟล์ปฏิทิน และเนื้อหาอีเมล
 *
 * รวมไว้ที่เดียวเพื่อไม่ให้แต่ละหน้าเขียน query ของตัวเองแล้วข้อมูลไม่ตรงกัน
 */
export type TicketView = {
  ticketId: string;
  qrToken: string;
  ticketCode: string;
  ticketType: string;
  registrationId: string;
  registrationCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "confirmed" | "cancelled" | "waitlist" | "no_show";
  locale: "th" | "en";
  createdAt: Date;
  event: {
    id: string;
    slug: string;
    nameTh: string;
    nameEn: string | null;
    startsAt: Date;
    endsAt: Date;
    venueName: string | null;
    venueAddress: string | null;
    mapUrl: string | null;
    travelNote: string | null;
    organizerName: string | null;
    organizerPhone: string | null;
    organizerEmail: string | null;
  };
  /** ช่วงเวลาที่ผู้ลงทะเบียนเลือกจริง — ใช้ระบุเวลาในอีเมลและปฏิทิน */
  sessions: { id: string; nameTh: string; nameEn: string | null; startsAt: Date; endsAt: Date }[];
};

async function loadSessions(registrationId: string) {
  return db
    .select({
      id: eventSessions.id,
      nameTh: eventSessions.nameTh,
      nameEn: eventSessions.nameEn,
      startsAt: eventSessions.startsAt,
      endsAt: eventSessions.endsAt,
    })
    .from(registrationSessions)
    .innerJoin(eventSessions, eq(registrationSessions.sessionId, eventSessions.id))
    .where(eq(registrationSessions.registrationId, registrationId))
    .orderBy(eventSessions.startsAt);
}

function toView(
  row: {
    tickets: typeof tickets.$inferSelect;
    registrations: typeof registrations.$inferSelect;
    events: typeof events.$inferSelect;
  },
  sessions: TicketView["sessions"],
): TicketView {
  return {
    ticketId: row.tickets.id,
    qrToken: row.tickets.qrToken,
    ticketCode: row.tickets.ticketCode,
    ticketType: row.tickets.ticketType,
    registrationId: row.registrations.id,
    registrationCode: row.registrations.registrationCode,
    firstName: row.registrations.firstName,
    lastName: row.registrations.lastName,
    email: row.registrations.email,
    phone: row.registrations.phone,
    status: row.registrations.status,
    locale: row.registrations.locale === "en" ? "en" : "th",
    createdAt: row.registrations.createdAt,
    event: {
      id: row.events.id,
      slug: row.events.slug,
      nameTh: row.events.nameTh,
      nameEn: row.events.nameEn,
      startsAt: row.events.startsAt,
      endsAt: row.events.endsAt,
      venueName: row.events.venueName,
      venueAddress: row.events.venueAddress,
      mapUrl: row.events.mapUrl,
      travelNote: row.events.travelNote,
      organizerName: row.events.organizerName,
      organizerPhone: row.events.organizerPhone,
      organizerEmail: row.events.organizerEmail,
    },
    sessions,
  };
}

/** ค้นตั๋วจาก QR token — ใช้ตอนผู้ใช้เปิดลิงก์บัตรเข้างานออนไลน์ */
export async function getTicketByToken(qrToken: string): Promise<TicketView | null> {
  const rows = await db
    .select()
    .from(tickets)
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(eq(tickets.qrToken, qrToken));

  const row = rows[0];
  if (!row) return null;
  return toView(row, await loadSessions(row.registrations.id));
}

/** ค้นตั๋วจากรหัสการลงทะเบียน — ใช้ตอนส่งอีเมลและในหน้า Admin */
export async function getTicketByRegistrationId(
  registrationId: string,
): Promise<TicketView | null> {
  const rows = await db
    .select()
    .from(tickets)
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(eq(registrations.id, registrationId));

  const row = rows[0];
  if (!row) return null;
  return toView(row, await loadSessions(row.registrations.id));
}

/** ช่วงเวลารวมของตั๋วใบนี้ — ใช้สร้างนัดในปฏิทินให้ตรงกับช่วงที่ผู้ใช้เลือกจริง */
export function ticketTimeRange(ticket: TicketView): { startsAt: Date; endsAt: Date } {
  if (ticket.sessions.length === 0) {
    return { startsAt: ticket.event.startsAt, endsAt: ticket.event.endsAt };
  }
  return {
    startsAt: new Date(Math.min(...ticket.sessions.map((s) => s.startsAt.getTime()))),
    endsAt: new Date(Math.max(...ticket.sessions.map((s) => s.endsAt.getTime()))),
  };
}
