import { and, asc, eq } from "drizzle-orm";
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

  /** เหตุผลที่ปิดรับ — ใช้เลือกข้อความและสถานะปุ่มบนหน้า Landing */
  const registrationState: "open" | "not_open_yet" | "closed" | "sold_out" =
    event.status !== "published"
      ? "closed"
      : event.registrationOpensAt && now < event.registrationOpensAt
        ? "not_open_yet"
        : event.registrationClosesAt && now > event.registrationClosesAt
          ? "closed"
          : totalRemaining <= 0
            ? "sold_out"
            : "open";

  return { event, sessions, totalRemaining, registrationState };
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
