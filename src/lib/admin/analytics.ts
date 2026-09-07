import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs, eventSessions, linkEvents, registrations } from "@/db/schema";

/**
 * แหล่งข้อมูลของ Dashboard ทั้ง 11 กราฟ (หัวข้อ 3.5 และ 8.6)
 *
 * ⚠️ ทุก query ที่จัดกลุ่มตาม "วัน" หรือ "ชั่วโมง" ต้องแปลงเป็นเวลาไทยก่อนเสมอ
 *    ด้วย AT TIME ZONE 'Asia/Bangkok' ไม่งั้นเซิร์ฟเวอร์ที่รันในโซน UTC
 *    จะจัดกลุ่มผิดวันสำหรับทุกเหตุการณ์ที่เกิดหลัง 17:00 น. ตามเวลาไทย
 */
const TZ = sql`'Asia/Bangkok'`;

export type DateRange = { from: Date | null; to: Date | null };

export type Point = { label: string; value: number };
export type SeriesPoint = { label: string; a: number; b: number };

function withinRange(column: Parameters<typeof gte>[0], range: DateRange) {
  const parts = [];
  if (range.from) parts.push(gte(column, range.from));
  if (range.to) parts.push(lte(column, range.to));
  return parts;
}

/* ------------------------------------------------------------------ */
/* ตัวเลขสรุปแถวบนสุด (KPI Cards)                                      */
/* ------------------------------------------------------------------ */

export type Kpi = {
  totalRegistrations: number;
  checkedIn: number;
  showUpRate: number;
  seatsRemaining: number;
  walkIn: number;
  failedEmails: number;
  cancelled: number;
};

export async function getKpi(eventId: string): Promise<Kpi> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*) filter (where ${registrations.status} <> 'cancelled')::int`,
      cancelled: sql<number>`count(*) filter (where ${registrations.status} = 'cancelled')::int`,
      walkIn: sql<number>`count(*) filter (where ${registrations.source} = 'walkin')::int`,
    })
    .from(registrations)
    .where(eq(registrations.eventId, eventId));

  const [seats] = await db
    .select({
      quota: sql<number>`coalesce(sum(${eventSessions.quota}), 0)::int`,
      reserved: sql<number>`coalesce(sum(${eventSessions.reservedCount}), 0)::int`,
    })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, eventId));

  // นับ "คน" ที่มาจริง ไม่ใช่จำนวนครั้งที่สแกน
  // คนที่ลงทั้งภาคเช้าและภาคบ่ายจะมี check_ins 2 แถว แต่ต้องนับเป็น 1 คน
  const attendedRows = await db.execute<{ people: number }>(sql`
    select count(distinct r.id)::int as people
    from check_ins ci
    join tickets t on t.id = ci.ticket_id
    join registrations r on r.id = t.registration_id
    where r.event_id = ${eventId}
  `);

  const [emails] = await db
    .select({
      failed: sql<number>`count(*) filter (where ${emailLogs.status} in ('failed','bounced'))::int`,
    })
    .from(emailLogs)
    .innerJoin(registrations, eq(registrations.id, emailLogs.registrationId))
    .where(eq(registrations.eventId, eventId));

  const total = counts?.total ?? 0;
  const checkedIn = Number(attendedRows[0]?.people ?? 0);

  return {
    totalRegistrations: total,
    checkedIn,
    showUpRate: total > 0 ? Math.round((checkedIn / total) * 1000) / 10 : 0,
    seatsRemaining: Math.max((seats?.quota ?? 0) - (seats?.reserved ?? 0), 0),
    walkIn: counts?.walkIn ?? 0,
    failedEmails: emails?.failed ?? 0,
    cancelled: counts?.cancelled ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 1 — ยอดลงทะเบียนสะสมรายวัน                                 */
/* ------------------------------------------------------------------ */

export async function getDailyRegistrations(
  eventId: string,
  range: DateRange,
): Promise<{ daily: Point[]; cumulative: Point[] }> {
  const rows = await db
    .select({
      day: sql<string>`to_char((${registrations.createdAt} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, eventId),
        sql`${registrations.status} <> 'cancelled'`,
        ...withinRange(registrations.createdAt, range),
      ),
    )
    .groupBy(sql`(${registrations.createdAt} AT TIME ZONE ${TZ})::date`)
    .orderBy(sql`(${registrations.createdAt} AT TIME ZONE ${TZ})::date`);

  let running = 0;
  const daily: Point[] = [];
  const cumulative: Point[] = [];
  for (const row of rows) {
    running += row.count;
    daily.push({ label: row.day, value: row.count });
    cumulative.push({ label: row.day, value: running });
  }
  return { daily, cumulative };
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 3 — สัดส่วนผู้เข้าร่วม ภาคเช้า vs ภาคบ่าย                    */
/* ------------------------------------------------------------------ */

export type SessionStat = {
  id: string;
  name: string;
  quota: number;
  registered: number;
  checkedIn: number;
};

export async function getSessionStats(eventId: string): Promise<SessionStat[]> {
  const rows = await db.execute<{
    id: string;
    name_th: string;
    quota: number;
    registered: number;
    checked_in: number;
  }>(sql`
    select es.id, es.name_th, es.quota,
      (select count(*)::int from registration_sessions rs
         join registrations r on r.id = rs.registration_id
        where rs.session_id = es.id and r.status <> 'cancelled') as registered,
      (select count(*)::int from check_ins ci where ci.session_id = es.id) as checked_in
    from event_sessions es
    where es.event_id = ${eventId}
    order by es.sort_order
  `);

  return rows.map((r) => ({
    id: r.id,
    name: r.name_th,
    quota: Number(r.quota),
    registered: Number(r.registered),
    checkedIn: Number(r.checked_in),
  }));
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 4 และ 5 — คำตอบของคำถามในฟอร์ม                              */
/* ------------------------------------------------------------------ */

/**
 * นับคำตอบของคำถามหนึ่งข้อ เรียงจากมากไปน้อย
 * ใช้กับกราฟที่ 4 (ช่องทางที่ทราบข้อมูล) และกราฟที่ 5 (รายการ TNN ที่ชื่นชอบ)
 */
export async function getAnswerBreakdown(eventId: string, questionKey: string): Promise<Point[]> {
  const rows = await db.execute<{ label: string; count: number }>(sql`
    select coalesce(fo.label_th, ra.value_text, 'ไม่ระบุ') as label,
           count(*)::int as count
    from registration_answers ra
    join form_questions fq on fq.id = ra.question_id
    join registrations r on r.id = ra.registration_id
    left join form_options fo on fo.id = ra.option_id
    where fq.event_id = ${eventId}
      and fq.key = ${questionKey}
      and r.status <> 'cancelled'
    group by 1
    order by count desc
  `);
  return rows.map((r) => ({ label: r.label, value: Number(r.count) }));
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 6 — สัดส่วนตามอาชีพ                                         */
/* ------------------------------------------------------------------ */

export async function getOccupationBreakdown(eventId: string): Promise<Point[]> {
  const rows = await db.execute<{ label: string; count: number }>(sql`
    select coalesce(nullif(r.occupation_other, ''), nullif(r.occupation, ''), 'ไม่ระบุ') as label,
           count(*)::int as count
    from registrations r
    where r.event_id = ${eventId} and r.status <> 'cancelled'
    group by 1
    order by count desc
  `);
  return rows.map((r) => ({ label: r.label, value: Number(r.count) }));
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 7 — ช่วงเวลาที่คนเช็คอินหนาแน่นที่สุด                        */
/* ------------------------------------------------------------------ */

export async function getCheckInByHour(eventId: string): Promise<Point[]> {
  const rows = await db.execute<{ hour: number; count: number }>(sql`
    select extract(hour from (ci.checked_in_at AT TIME ZONE 'Asia/Bangkok'))::int as hour,
           count(*)::int as count
    from check_ins ci
    join event_sessions es on es.id = ci.session_id
    where es.event_id = ${eventId}
    group by 1
    order by 1
  `);

  const byHour = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  if (byHour.size === 0) return [];

  // เติมชั่วโมงที่ไม่มีใครเช็คอินให้เป็น 0 ด้วย
  // ไม่งั้นกราฟจะกระโดดข้ามชั่วโมงว่าง ทำให้ดูเหมือนคนมาต่อเนื่องทั้งที่มีช่วงเงียบ
  const hours = [...byHour.keys()];
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const out: Point[] = [];
  for (let h = min; h <= max; h++) {
    out.push({ label: `${String(h).padStart(2, "0")}:00`, value: byHour.get(h) ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 8 — ผลงานรายลิงก์                                           */
/* ------------------------------------------------------------------ */

export type LinkStat = {
  id: string;
  code: string;
  label: string;
  channel: string | null;
  isActive: boolean;
  clicks: number;
  uniqueVisitors: number;
  viewForm: number;
  conversions: number;
  conversionRate: number;
  attended: number;
  shares: number;
};

export async function getLinkStats(eventId: string): Promise<LinkStat[]> {
  const rows = await db.execute<{
    id: string;
    code: string;
    label: string;
    channel: string | null;
    is_active: boolean;
    clicks: number;
    uniques: number;
    view_form: number;
    conversions: number;
    attended: number;
    shares: number;
  }>(sql`
    select sl.id, sl.code, sl.label, sl.channel, sl.is_active,
      (select count(*)::int from link_events le
         where le.share_link_id = sl.id and le.action = 'click') as clicks,
      (select count(distinct le.visitor_hash)::int from link_events le
         where le.share_link_id = sl.id and le.action = 'click'
           and le.visitor_hash is not null) as uniques,
      (select count(*)::int from link_events le
         where le.share_link_id = sl.id and le.action = 'view_form') as view_form,
      (select count(*)::int from registrations r
         where r.share_link_id = sl.id and r.status <> 'cancelled') as conversions,
      (select count(distinct r.id)::int
         from registrations r
         join tickets t on t.registration_id = r.id
         join check_ins ci on ci.ticket_id = t.id
         where r.share_link_id = sl.id) as attended,
      (select count(*)::int from link_events le
         where le.share_link_id = sl.id and le.action in ('share','copy_link')) as shares
    from share_links sl
    where sl.event_id = ${eventId}
    order by conversions desc, clicks desc
  `);

  return rows.map((r) => {
    const clicks = Number(r.clicks);
    const conversions = Number(r.conversions);
    return {
      id: r.id,
      code: r.code,
      label: r.label,
      channel: r.channel,
      isActive: r.is_active,
      clicks,
      uniqueVisitors: Number(r.uniques),
      viewForm: Number(r.view_form),
      conversions,
      // อัตราแปลง = ลงทะเบียนสำเร็จ ÷ คลิก — ตัวเลขที่สำคัญที่สุดของหัวข้อ 8.5
      conversionRate: clicks > 0 ? Math.round((conversions / clicks) * 1000) / 10 : 0,
      attended: Number(r.attended),
      shares: Number(r.shares),
    };
  });
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 9 — กรวยการแปลง (Conversion Funnel)                         */
/* ------------------------------------------------------------------ */

export type FunnelStep = { label: string; value: number; note: string };

export async function getFunnel(eventId: string): Promise<FunnelStep[]> {
  const [clicks] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(linkEvents)
    .where(and(eq(linkEvents.eventId, eventId), eq(linkEvents.action, "click")));

  const [viewForm] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(linkEvents)
    .where(and(eq(linkEvents.eventId, eventId), eq(linkEvents.action, "view_form")));

  const [confirmed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), sql`${registrations.status} <> 'cancelled'`));

  const attendedRows = await db.execute<{ n: number }>(sql`
    select count(distinct r.id)::int as n
    from registrations r
    join tickets t on t.registration_id = r.id
    join check_ins ci on ci.ticket_id = t.id
    where r.event_id = ${eventId}
  `);

  return [
    { label: "เห็นหน้างาน", value: clicks?.n ?? 0, note: "กดลิงก์เข้ามา" },
    { label: "เริ่มกรอกฟอร์ม", value: viewForm?.n ?? 0, note: "เข้าถึงหน้าฟอร์ม" },
    { label: "ลงทะเบียนสำเร็จ", value: confirmed?.n ?? 0, note: "จบกระบวนการ" },
    { label: "มางานจริง", value: Number(attendedRows[0]?.n ?? 0), note: "เช็คอินหน้างาน" },
  ];
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 10 — การแชร์แยกตามแพลตฟอร์ม                                 */
/* ------------------------------------------------------------------ */

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  line: "LINE",
  x: "X (Twitter)",
  copy: "คัดลอกลิงก์",
};

export async function getShareBreakdown(eventId: string): Promise<Point[]> {
  const rows = await db.execute<{ platform: string | null; count: number }>(sql`
    select le.platform, count(*)::int as count
    from link_events le
    where le.event_id = ${eventId} and le.action in ('share','copy_link')
    group by 1
    order by count desc
  `);
  return rows.map((r) => ({
    label: PLATFORM_LABEL[r.platform ?? ""] ?? r.platform ?? "ไม่ระบุ",
    value: Number(r.count),
  }));
}

/* ------------------------------------------------------------------ */
/* กราฟที่ 11 — ยอดคลิกเทียบยอดลงทะเบียน รายวัน                        */
/* ------------------------------------------------------------------ */

export async function getClicksVsRegistrations(eventId: string): Promise<SeriesPoint[]> {
  const rows = await db.execute<{ day: string; clicks: number; regs: number }>(sql`
    with days as (
      select (le.created_at AT TIME ZONE 'Asia/Bangkok')::date as d
      from link_events le where le.event_id = ${eventId} and le.action = 'click'
      union
      select (r.created_at AT TIME ZONE 'Asia/Bangkok')::date as d
      from registrations r where r.event_id = ${eventId} and r.status <> 'cancelled'
    )
    select to_char(days.d, 'YYYY-MM-DD') as day,
      (select count(*)::int from link_events le
        where le.event_id = ${eventId} and le.action = 'click'
          and (le.created_at AT TIME ZONE 'Asia/Bangkok')::date = days.d) as clicks,
      (select count(*)::int from registrations r
        where r.event_id = ${eventId} and r.status <> 'cancelled'
          and (r.created_at AT TIME ZONE 'Asia/Bangkok')::date = days.d) as regs
    from days
    order by days.d
  `);
  return rows.map((r) => ({ label: r.day, a: Number(r.clicks), b: Number(r.regs) }));
}

/* ------------------------------------------------------------------ */
/* รวมทุกกราฟไว้ในการเรียกครั้งเดียว                                    */
/* ------------------------------------------------------------------ */

export async function getDashboardData(eventId: string, range: DateRange) {
  const [
    kpi,
    daily,
    sessions,
    hearFrom,
    programs,
    occupations,
    checkInHours,
    links,
    funnel,
    shares,
    clicksVsRegs,
  ] = await Promise.all([
    getKpi(eventId),
    getDailyRegistrations(eventId, range),
    getSessionStats(eventId),
    getAnswerBreakdown(eventId, "hear_from"),
    getAnswerBreakdown(eventId, "favorite_tnn_program"),
    getOccupationBreakdown(eventId),
    getCheckInByHour(eventId),
    getLinkStats(eventId),
    getFunnel(eventId),
    getShareBreakdown(eventId),
    getClicksVsRegistrations(eventId),
  ]);

  return {
    kpi,
    daily,
    sessions,
    hearFrom,
    programs,
    occupations,
    checkInHours,
    links,
    funnel,
    shares,
    clicksVsRegs,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
