import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { eventSessions, events, formOptions, formQuestions, shareLinks } from "./schema";

/** ข้อมูลงานพร้อมช่วงเวลาและที่นั่งคงเหลือ */
export type SessionView = {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string | null;
  startsAt: Date;
  endsAt: Date;
  quota: number;
  remaining: number;
  isClosed: boolean;
  isFull: boolean;
};

export type EventView = Awaited<ReturnType<typeof getEventBySlug>>;

export async function getEventBySlug(slug: string) {
  const [event] = await db.select().from(events).where(eq(events.slug, slug));
  if (!event) return null;

  const sessionRows = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(asc(eventSessions.sortOrder));

  const sessions: SessionView[] = sessionRows.map((s) => {
    const remaining = Math.max(s.quota - s.reservedCount, 0);
    return {
      id: s.id,
      code: s.code,
      nameTh: s.nameTh,
      nameEn: s.nameEn,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      quota: s.quota,
      remaining,
      isClosed: s.isClosed,
      isFull: remaining <= 0,
    };
  });

  const totalRemaining = sessions.reduce((sum, s) => sum + (s.isClosed ? 0 : s.remaining), 0);
  const now = new Date();

  const registrationState = computeRegistrationState(event, totalRemaining, now);

  return { event, sessions, totalRemaining, registrationState };
}

export type RegistrationState = "open" | "not_open_yet" | "closed" | "sold_out";

/**
 * เหตุผลที่รับหรือไม่รับลงทะเบียน — ใช้เลือกข้อความและสถานะปุ่ม
 *
 * แยกออกมาเป็นฟังก์ชันเพราะทั้งหน้ารายละเอียดงานและการ์ดบนหน้าแรกต้องใช้ตรรกะเดียวกัน
 * ถ้าเขียนแยกกันสองที่ วันหนึ่งจะเพี้ยนกัน เช่นหน้าแรกบอก "เปิดรับ" แต่กดเข้าไปแล้วปิด
 */
export function computeRegistrationState(
  event: {
    status: string;
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
  },
  totalRemaining: number,
  now: Date = new Date(),
): RegistrationState {
  if (event.status !== "published") return "closed";
  if (event.registrationOpensAt && now < event.registrationOpensAt) return "not_open_yet";
  if (event.registrationClosesAt && now > event.registrationClosesAt) return "closed";
  if (totalRemaining <= 0) return "sold_out";
  return "open";
}

/** การ์ดงานหนึ่งใบบนหน้าแรก */
export type EventCard = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string | null;
  descriptionTh: string | null;
  category: string | null;
  venueName: string | null;
  startsAt: Date;
  endsAt: Date;
  themeColor: string;
  totalQuota: number;
  totalRemaining: number;
  registrationState: RegistrationState;
  hasEnded: boolean;
};

/**
 * รายชื่องานทั้งหมดที่เผยแพร่แล้ว สำหรับหน้าแรก
 *
 * ⚠️ รวมยอดที่นั่งด้วย SQL ครั้งเดียว ไม่วนถามทีละงาน
 *    ถ้าวน query ตามจำนวนงาน หน้าแรกจะช้าลงเรื่อย ๆ ทุกครั้งที่เพิ่มงานใหม่
 *    (ปัญหา N+1) ซึ่งเป็นหน้าที่คนเข้าเยอะที่สุดของระบบ
 *
 * นับเฉพาะช่วงเวลาที่ยังไม่ปิด — ช่วงที่ปิดแล้วไม่ควรถูกนับเป็นที่นั่งว่าง
 */
export async function listPublishedEvents(): Promise<EventCard[]> {
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      nameEn: events.nameEn,
      descriptionTh: events.descriptionTh,
      category: events.category,
      venueName: events.venueName,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      themeColor: events.themeColor,
      status: events.status,
      registrationOpensAt: events.registrationOpensAt,
      registrationClosesAt: events.registrationClosesAt,
      quota: sql<number>`coalesce(sum(${eventSessions.quota}) filter (where ${eventSessions.isClosed} = false), 0)::int`,
      reserved: sql<number>`coalesce(sum(${eventSessions.reservedCount}) filter (where ${eventSessions.isClosed} = false), 0)::int`,
    })
    .from(events)
    .leftJoin(eventSessions, eq(eventSessions.eventId, events.id))
    .where(eq(events.status, "published"))
    .groupBy(events.id)
    .orderBy(desc(events.startsAt));

  const now = new Date();

  return rows.map((row) => {
    const totalRemaining = Math.max(row.quota - row.reserved, 0);
    return {
      id: row.id,
      slug: row.slug,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      descriptionTh: row.descriptionTh,
      category: row.category,
      venueName: row.venueName,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      themeColor: row.themeColor,
      totalQuota: row.quota,
      totalRemaining,
      registrationState: computeRegistrationState(row, totalRemaining, now),
      hasEnded: row.endsAt < now,
    };
  });
}

/** คำถามในฟอร์มพร้อมตัวเลือก เรียงตามลำดับที่ Admin ตั้งไว้ */
export type QuestionView = {
  id: string;
  key: string;
  labelTh: string;
  labelEn: string | null;
  helperTextTh: string | null;
  helperTextEn: string | null;
  type: "text" | "dropdown" | "radio" | "checkbox" | "consent";
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  hasOtherOption: boolean;
  options: { id: string; labelTh: string; labelEn: string | null; isOther: boolean }[];
};

export async function getFormQuestions(eventId: string): Promise<QuestionView[]> {
  const questions = await db
    .select()
    .from(formQuestions)
    .where(and(eq(formQuestions.eventId, eventId), eq(formQuestions.isActive, true)))
    .orderBy(asc(formQuestions.sortOrder));

  if (questions.length === 0) return [];

  const options = await db
    .select()
    .from(formOptions)
    .where(eq(formOptions.isActive, true))
    .orderBy(asc(formOptions.sortOrder));

  const byQuestion = new Map<string, typeof options>();
  for (const o of options) {
    const list = byQuestion.get(o.questionId) ?? [];
    list.push(o);
    byQuestion.set(o.questionId, list);
  }

  return questions.map((q) => ({
    id: q.id,
    key: q.key,
    labelTh: q.labelTh,
    labelEn: q.labelEn,
    helperTextTh: q.helperTextTh,
    helperTextEn: q.helperTextEn,
    type: q.type,
    isRequired: q.isRequired,
    minSelect: q.minSelect,
    maxSelect: q.maxSelect,
    hasOtherOption: q.hasOtherOption,
    options: (byQuestion.get(q.id) ?? []).map((o) => ({
      id: o.id,
      labelTh: o.labelTh,
      labelEn: o.labelEn,
      isOther: o.isOther,
    })),
  }));
}

/** ลิงก์ติดตามผลจากรหัสสั้น — ใช้ที่หน้า /r/[code] */
export async function getShareLinkByCode(code: string) {
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.code, code), eq(shareLinks.isActive, true)));
  return link ?? null;
}
