"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, eventSessions, events, registrationSessions, registrations, tickets } from "@/db/schema";
import { canScan, getSession } from "@/lib/auth/session";
import { checkInByTokenAction, type CheckInResult } from "./checkin";

/**
 * ดาวน์โหลดรายชื่อผู้ลงทะเบียนลงเครื่องเจ้าหน้าที่
 *
 * ⚠️ ต้องกดก่อนวันงาน (ขั้นตอนที่ 21) เพื่อให้เครื่องพร้อมทำงานแม้ Wi-Fi ในงานล่ม
 *    ส่งเฉพาะข้อมูลที่จำเป็นต่อการเช็คอิน ไม่ส่งอีเมลเต็มหรือข้อมูลที่ไม่ได้ใช้หน้างาน
 */
export type AttendeePayload = {
  qrToken: string;
  firstName: string;
  lastName: string;
  occupation: string | null;
  registrationCode: string;
  phoneMasked: string;
  sessionNames: string[];
  checkedIn: boolean;
};

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}-xxx-${phone.slice(-4)}`;
}

export async function downloadAttendeesAction(eventSlug: string): Promise<AttendeePayload[]> {
  const staff = await getSession();
  if (!canScan(staff)) return [];

  const rows = await db
    .select({
      qrToken: tickets.qrToken,
      ticketId: tickets.id,
      registrationId: registrations.id,
      firstName: registrations.firstName,
      lastName: registrations.lastName,
      occupation: registrations.occupation,
      registrationCode: registrations.registrationCode,
      phone: registrations.phone,
    })
    .from(registrations)
    .innerJoin(tickets, eq(tickets.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(and(eq(events.slug, eventSlug), eq(registrations.status, "confirmed")));

  if (rows.length === 0) return [];

  const checked = await db
    .select({ ticketId: checkIns.ticketId })
    .from(checkIns)
    .innerJoin(tickets, eq(checkIns.ticketId, tickets.id))
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(eq(events.slug, eventSlug));
  const checkedSet = new Set(checked.map((c) => c.ticketId));

  const sessionRows = await db
    .select({
      registrationId: registrationSessions.registrationId,
      nameTh: eventSessions.nameTh,
    })
    .from(registrationSessions)
    .innerJoin(eventSessions, eq(registrationSessions.sessionId, eventSessions.id))
    .innerJoin(registrations, eq(registrationSessions.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(eq(events.slug, eventSlug))
    .orderBy(eventSessions.startsAt);

  const sessionMap = new Map<string, string[]>();
  for (const s of sessionRows) {
    const list = sessionMap.get(s.registrationId) ?? [];
    list.push(s.nameTh);
    sessionMap.set(s.registrationId, list);
  }

  return rows.map((r) => ({
    qrToken: r.qrToken,
    firstName: r.firstName,
    lastName: r.lastName,
    occupation: r.occupation,
    registrationCode: r.registrationCode,
    phoneMasked: maskPhone(r.phone),
    sessionNames: sessionMap.get(r.registrationId) ?? [],
    checkedIn: checkedSet.has(r.ticketId),
  }));
}

/**
 * ส่งการเช็คอินที่ค้างอยู่บนเครื่องขึ้นเซิร์ฟเวอร์
 *
 * ส่ง checkedInAt ซึ่งเป็นเวลาจริงที่สแกนบนเครื่อง ไม่ใช่เวลาที่ sync
 * ฐานข้อมูลมี unique index (ticket_id, session_id) กันซ้ำอยู่แล้ว
 * ทำให้กฎ "เวลาเช็คอินที่เร็วที่สุดชนะ" ทำงานได้ถูกต้องเมื่อ 2 เครื่องสแกนคนเดียวกัน
 */
export type SyncOutcome = {
  qrToken: string;
  status: CheckInResult["status"];
};

export async function syncPendingCheckInsAction(
  items: { qrToken: string; checkedInAt: string; deviceId: string; method: "qr" | "search" }[],
): Promise<SyncOutcome[]> {
  const staff = await getSession();
  if (!canScan(staff)) return [];

  const outcomes: SyncOutcome[] = [];
  for (const item of items) {
    const result = await checkInByTokenAction({
      qrToken: item.qrToken,
      deviceId: item.deviceId,
      method: item.method,
      clientCheckedInAt: item.checkedInAt,
    });
    outcomes.push({ qrToken: item.qrToken, status: result.status });
  }
  return outcomes;
}
