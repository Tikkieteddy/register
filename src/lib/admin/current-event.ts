import { desc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { events, eventSessions, registrations } from "@/db/schema";

/** ชื่อคุกกี้ที่จำว่าผู้ดูแลกำลังทำงานกับงานไหนอยู่ */
export const ADMIN_EVENT_COOKIE = "admin_event";

/**
 * งานที่หลังบ้านกำลังจัดการอยู่
 *
 * ต่างจาก getActiveEventSlug ของฝั่งเจ้าหน้าที่ตรงที่หลังบ้านต้องเห็น
 * งานที่ยังเป็น draft ด้วย ไม่งั้นตั้งค่างานใหม่ก่อนเปิดรับไม่ได้เลย
 *
 * ลำดับการเลือก:
 *   ① slug ที่ส่งมาทาง ?event= — ใช้ตอนต้องการลิงก์ตรงไปงานใดงานหนึ่ง
 *   ② คุกกี้ที่ผู้ดูแลเลือกไว้ล่าสุด
 *   ③ งานที่วันเริ่มใหม่สุด — ค่าเริ่มต้นตอนเพิ่งล็อกอิน
 *
 * ⚠️ ต้องจำด้วยคุกกี้ ไม่ใช่พารามิเตอร์ใน URL
 *    หลังบ้านมี 8 หน้าและลิงก์ภายในอีกหลายสิบจุด ถ้าผูกงานไว้กับ URL
 *    ทุกลิงก์ต้องพก ?event= ติดไปด้วยทุกครั้ง พลาดจุดเดียวผู้ดูแลจะเด้ง
 *    กลับไปงานอื่นโดยไม่รู้ตัว แล้วอาจแก้ข้อมูลผิดงาน
 */
export async function getAdminEvent(slug?: string) {
  if (slug) {
    const [bySlug] = await db.select().from(events).where(eq(events.slug, slug));
    if (bySlug) return bySlug;
  }

  const jar = await cookies();
  const remembered = jar.get(ADMIN_EVENT_COOKIE)?.value;
  if (remembered) {
    const [byCookie] = await db.select().from(events).where(eq(events.slug, remembered));
    // ถ้างานที่จำไว้ถูกลบไปแล้ว ให้ตกลงไปใช้งานล่าสุดแทนการขึ้นหน้าว่าง
    if (byCookie) return byCookie;
  }

  const [latest] = await db.select().from(events).orderBy(desc(events.startsAt)).limit(1);
  return latest ?? null;
}

export type AdminEventOption = {
  id: string;
  slug: string;
  nameTh: string;
  status: "draft" | "published" | "closed" | "archived";
  startsAt: Date;
};

export async function listAdminEvents(): Promise<AdminEventOption[]> {
  return db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      status: events.status,
      startsAt: events.startsAt,
    })
    .from(events)
    .orderBy(desc(events.startsAt));
}

export type AdminEventSummary = AdminEventOption & {
  /** จำนวนผู้ลงทะเบียนที่ยังไม่ยกเลิก */
  registrationCount: number;
  /** ที่นั่งที่เปิดรับรวมทุกช่วงเวลา */
  quotaTotal: number;
  /** ที่นั่งที่ยังว่าง — รวมที่กำลังจองค้างไว้ว่าถูกใช้แล้ว */
  seatsLeft: number;
};

/**
 * รายการงานพร้อมตัวเลขสรุปของแต่ละงาน — ใช้ในหน้าแรกของหลังบ้าน
 *
 * ⚠️ ต้องรวมตัวเลขในฐานข้อมูลครั้งเดียว ห้ามวนลูปยิงทีละงาน
 *    ระบบรองรับหลายงานพร้อมกัน ถ้ายิงทีละงานพอมี 20 งานก็กลายเป็น 40 คำขอ
 *    หน้าแรกจะอืดขึ้นเรื่อย ๆ ตามจำนวนงานที่เพิ่มขึ้น
 */
export async function listAdminEventSummaries(): Promise<AdminEventSummary[]> {
  const [list, seatRows, regRows] = await Promise.all([
    listAdminEvents(),
    db
      .select({
        eventId: eventSessions.eventId,
        quota: sql<number>`coalesce(sum(${eventSessions.quota}), 0)::int`,
        reserved: sql<number>`coalesce(sum(${eventSessions.reservedCount}), 0)::int`,
      })
      .from(eventSessions)
      .groupBy(eventSessions.eventId),
    db
      .select({
        eventId: registrations.eventId,
        total: sql<number>`count(*)::int`,
      })
      .from(registrations)
      .where(sql`${registrations.status} <> 'cancelled'`)
      .groupBy(registrations.eventId),
  ]);

  const seats = new Map(seatRows.map((r) => [r.eventId, r]));
  const regs = new Map(regRows.map((r) => [r.eventId, r.total]));

  return list.map((event) => {
    const seat = seats.get(event.id);
    const quotaTotal = seat?.quota ?? 0;
    const reserved = seat?.reserved ?? 0;
    return {
      ...event,
      registrationCount: regs.get(event.id) ?? 0,
      quotaTotal,
      // กันค่าติดลบตอนเปิดให้ลงทะเบียนหน้างานเกินโควตา
      seatsLeft: Math.max(0, quotaTotal - reserved),
    };
  });
}
