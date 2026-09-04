"use server";

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  badgePrints,
  checkIns,
  eventSessions,
  events,
  registrationSessions,
  registrations,
  tickets,
  users,
} from "@/db/schema";
import { canScan, getSession } from "@/lib/auth/session";

/**
 * การเช็คอินหน้างาน ตามข้อกำหนด B1
 *
 * ⚠️ ต้องตรวจ token ฝั่งเซิร์ฟเวอร์ทุกครั้ง ห้ามเชื่อผลจากฝั่ง client
 *    แม้แต่ตอนที่เครื่องเจ้าหน้าที่ทำงานออฟไลน์แล้วส่งมา sync ทีหลัง
 */

export type CheckInPerson = {
  registrationId: string;
  ticketId: string;
  firstName: string;
  lastName: string;
  occupation: string | null;
  registrationCode: string;
  sessionNames: string[];
};

export type CheckInResult =
  /** ✅ เช็คอินสำเร็จ — จอเขียว */
  | { status: "success"; person: CheckInPerson; checkedInAt: string }
  /** ⚠️ เช็คอินไปแล้ว — จอเหลือง */
  | {
      status: "duplicate";
      person: CheckInPerson;
      checkedInAt: string;
      byStaffName: string | null;
      minutesAgo: number;
    }
  /** ❌ ไม่พบข้อมูล หรือตั๋วถูกยกเลิก — จอแดง */
  | { status: "invalid"; reason: string }
  /** ไม่มีสิทธิ์ */
  | { status: "forbidden"; reason: string };

async function loadPerson(ticketId: string): Promise<CheckInPerson | null> {
  const rows = await db
    .select({
      registrationId: registrations.id,
      ticketId: tickets.id,
      firstName: registrations.firstName,
      lastName: registrations.lastName,
      occupation: registrations.occupation,
      registrationCode: registrations.registrationCode,
    })
    .from(tickets)
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .where(eq(tickets.id, ticketId));

  const row = rows[0];
  if (!row) return null;

  const sessions = await db
    .select({ nameTh: eventSessions.nameTh })
    .from(registrationSessions)
    .innerJoin(eventSessions, eq(registrationSessions.sessionId, eventSessions.id))
    .where(eq(registrationSessions.registrationId, row.registrationId))
    .orderBy(eventSessions.startsAt);

  return { ...row, sessionNames: sessions.map((s) => s.nameTh) };
}

/**
 * เช็คอินด้วย QR token
 *
 * @param clientCheckedInAt เวลาจริงที่สแกนบนเครื่องเจ้าหน้าที่
 *        ใช้ตอน sync ข้อมูลที่บันทึกไว้ตอนออฟไลน์ เพื่อให้กฎ
 *        "เวลาเช็คอินที่เร็วที่สุดชนะ" ทำงานได้ถูกต้อง
 */
export async function checkInByTokenAction(params: {
  qrToken: string;
  deviceId?: string;
  method?: "qr" | "search" | "walkin";
  clientCheckedInAt?: string;
}): Promise<CheckInResult> {
  const staff = await getSession();
  if (!canScan(staff)) {
    return { status: "forbidden", reason: "ไม่มีสิทธิ์เช็คอิน กรุณาเข้าสู่ระบบใหม่" };
  }

  const rows = await db
    .select({
      ticketId: tickets.id,
      ticketStatus: tickets.status,
      registrationId: registrations.id,
      registrationStatus: registrations.status,
    })
    .from(tickets)
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .where(eq(tickets.qrToken, params.qrToken));

  const found = rows[0];
  if (!found) {
    return { status: "invalid", reason: "QR Code นี้ไม่ถูกต้อง หรือไม่ใช่ของงานนี้" };
  }
  if (found.registrationStatus === "cancelled" || found.ticketStatus === "void") {
    return { status: "invalid", reason: "ตั๋วใบนี้ถูกยกเลิกแล้ว" };
  }

  const person = await loadPerson(found.ticketId);
  if (!person) return { status: "invalid", reason: "ไม่พบข้อมูลผู้ลงทะเบียน" };

  // ช่วงเวลาที่ผู้ลงทะเบียนเลือกไว้ — เช็คอินเข้าช่วงแรกที่ยังไม่ได้เช็คอิน
  const sessionRows = await db
    .select({ sessionId: registrationSessions.sessionId })
    .from(registrationSessions)
    .innerJoin(eventSessions, eq(registrationSessions.sessionId, eventSessions.id))
    .where(eq(registrationSessions.registrationId, found.registrationId))
    .orderBy(eventSessions.startsAt);

  const firstSession = sessionRows[0];
  if (!firstSession) {
    return { status: "invalid", reason: "ผู้ลงทะเบียนรายนี้ไม่ได้เลือกช่วงเวลา" };
  }

  const checkedInAt = params.clientCheckedInAt ? new Date(params.clientCheckedInAt) : new Date();

  try {
    const inserted = await db.transaction(async (tx) => {
      /**
       * unique index (ticket_id, session_id) เป็นตัวกันการเช็คอินซ้ำที่ระดับฐานข้อมูล
       * onConflictDoNothing ทำให้การสแกนซ้ำไม่ล้ม แต่ก็ไม่สร้างแถวใหม่
       */
      const result = await tx
        .insert(checkIns)
        .values({
          ticketId: found.ticketId,
          sessionId: firstSession.sessionId,
          staffUserId: staff?.id ?? null,
          checkedInAt,
          syncedAt: new Date(),
          method: params.method ?? "qr",
          deviceId: params.deviceId ?? null,
          isOfflineSync: Boolean(params.clientCheckedInAt),
        })
        .onConflictDoNothing()
        .returning({ id: checkIns.id });

      if (result.length > 0) {
        await tx
          .update(eventSessions)
          .set({
            checkedInCount: sql`${eventSessions.checkedInCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(eventSessions.id, firstSession.sessionId));
      }

      return result.length > 0;
    });

    if (inserted) {
      return { status: "success", person, checkedInAt: checkedInAt.toISOString() };
    }

    // เช็คอินไปแล้ว — ดึงข้อมูลการเช็คอินครั้งแรกมาแสดง
    const existing = await db
      .select({
        checkedInAt: checkIns.checkedInAt,
        staffName: users.fullName,
      })
      .from(checkIns)
      .leftJoin(users, eq(checkIns.staffUserId, users.id))
      .where(
        and(eq(checkIns.ticketId, found.ticketId), eq(checkIns.sessionId, firstSession.sessionId)),
      );

    const prev = existing[0];
    const at = prev?.checkedInAt ?? new Date();
    return {
      status: "duplicate",
      person,
      checkedInAt: at.toISOString(),
      byStaffName: prev?.staffName ?? null,
      minutesAgo: Math.max(0, Math.round((Date.now() - at.getTime()) / 60000)),
    };
  } catch (error) {
    console.error("[checkin] บันทึกการเช็คอินล้มเหลว:", error);
    return { status: "invalid", reason: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

/** ค้นหาผู้ลงทะเบียน — ใช้เมื่อสแกน QR ไม่ติด (ข้อกำหนด B1) */
export type SearchHit = {
  qrToken: string;
  firstName: string;
  lastName: string;
  registrationCode: string;
  /** ปิดบังบางส่วนเพื่อความเป็นส่วนตัว แต่ยังใช้ยืนยันตัวตนได้ */
  phoneMasked: string;
  sessionNames: string[];
  checkedIn: boolean;
  checkedInAt: string | null;
};

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}-xxx-${phone.slice(-4)}`;
}

export async function searchRegistrantsAction(
  eventSlug: string,
  keyword: string,
): Promise<SearchHit[]> {
  const staff = await getSession();
  if (!canScan(staff)) return [];

  const q = keyword.trim();
  if (q.length < 2) return [];

  const pattern = `%${q}%`;
  const rows = await db
    .select({
      qrToken: tickets.qrToken,
      ticketId: tickets.id,
      firstName: registrations.firstName,
      lastName: registrations.lastName,
      registrationCode: registrations.registrationCode,
      phone: registrations.phone,
      registrationId: registrations.id,
    })
    .from(registrations)
    .innerJoin(tickets, eq(tickets.registrationId, registrations.id))
    .innerJoin(events, eq(registrations.eventId, events.id))
    .where(
      and(
        eq(events.slug, eventSlug),
        eq(registrations.status, "confirmed"),
        or(
          ilike(registrations.firstName, pattern),
          ilike(registrations.lastName, pattern),
          ilike(registrations.email, pattern),
          ilike(registrations.phone, pattern),
          ilike(registrations.registrationCode, pattern),
        ),
      ),
    )
    .limit(20);

  if (rows.length === 0) return [];

  const ticketIds = rows.map((r) => r.ticketId);
  const checkedRows = await db
    .select({ ticketId: checkIns.ticketId, checkedInAt: checkIns.checkedInAt })
    .from(checkIns)
    .where(inArray(checkIns.ticketId, ticketIds));
  const checkedMap = new Map(checkedRows.map((c) => [c.ticketId, c.checkedInAt]));

  const registrationIds = rows.map((r) => r.registrationId);
  const sessionRows = await db
    .select({
      registrationId: registrationSessions.registrationId,
      nameTh: eventSessions.nameTh,
    })
    .from(registrationSessions)
    .innerJoin(eventSessions, eq(registrationSessions.sessionId, eventSessions.id))
    .where(inArray(registrationSessions.registrationId, registrationIds))
    .orderBy(eventSessions.startsAt);

  const sessionMap = new Map<string, string[]>();
  for (const s of sessionRows) {
    const list = sessionMap.get(s.registrationId) ?? [];
    list.push(s.nameTh);
    sessionMap.set(s.registrationId, list);
  }

  return rows.map((r) => {
    const at = checkedMap.get(r.ticketId) ?? null;
    return {
      qrToken: r.qrToken,
      firstName: r.firstName,
      lastName: r.lastName,
      registrationCode: r.registrationCode,
      phoneMasked: maskPhone(r.phone),
      sessionNames: sessionMap.get(r.registrationId) ?? [],
      checkedIn: at !== null,
      checkedInAt: at ? at.toISOString() : null,
    };
  });
}

/** ตัวนับผู้เช็คอินแบบสด ตามข้อกำหนด B1 */
export type CheckInStats = {
  total: number;
  checkedIn: number;
  percent: number;
  bySession: { name: string; checkedIn: number; total: number }[];
};

export async function getCheckInStatsAction(eventSlug: string): Promise<CheckInStats | null> {
  const staff = await getSession();
  if (!staff) return null;

  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, eventSlug));
  if (!event) return null;

  const sessions = await db
    .select({
      id: eventSessions.id,
      name: eventSessions.nameTh,
      checkedIn: eventSessions.checkedInCount,
    })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(eventSessions.sortOrder);

  const perSession = await db
    .select({
      sessionId: registrationSessions.sessionId,
      total: sql<number>`count(*)::int`,
    })
    .from(registrationSessions)
    .innerJoin(registrations, eq(registrationSessions.registrationId, registrations.id))
    .where(and(eq(registrations.eventId, event.id), eq(registrations.status, "confirmed")))
    .groupBy(registrationSessions.sessionId);

  const totalMap = new Map(perSession.map((p) => [p.sessionId, p.total]));

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(registrations)
    .where(and(eq(registrations.eventId, event.id), eq(registrations.status, "confirmed")));

  const [checked] = await db
    .select({ n: sql<number>`count(distinct ${checkIns.ticketId})::int` })
    .from(checkIns)
    .innerJoin(tickets, eq(checkIns.ticketId, tickets.id))
    .innerJoin(registrations, eq(tickets.registrationId, registrations.id))
    .where(eq(registrations.eventId, event.id));

  const total = totals?.total ?? 0;
  const checkedIn = checked?.n ?? 0;

  return {
    total,
    checkedIn,
    percent: total > 0 ? Math.round((checkedIn / total) * 1000) / 10 : 0,
    bySession: sessions.map((s) => ({
      name: s.name,
      checkedIn: s.checkedIn,
      total: totalMap.get(s.id) ?? 0,
    })),
  };
}

/** บันทึกการพิมพ์บัตร — รู้ว่าใช้กระดาษไปเท่าไร ใครสั่งพิมพ์ */
export async function recordBadgePrintAction(params: {
  qrToken: string;
  format: "lanyard" | "wristband" | "sticker";
  isReprint: boolean;
}): Promise<{ ok: boolean }> {
  const staff = await getSession();
  if (!canScan(staff)) return { ok: false };

  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.qrToken, params.qrToken));
  if (!ticket) return { ok: false };

  await db.insert(badgePrints).values({
    ticketId: ticket.id,
    staffUserId: staff?.id ?? null,
    format: params.format,
    isReprint: params.isReprint,
  });

  return { ok: true };
}
