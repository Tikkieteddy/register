import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * การค้นหาและกรองรายชื่อผู้ลงทะเบียนในหลังบ้าน (หัวข้อ 3.3)
 *
 * เขียนเป็น SQL ตรงแทน query builder เพราะต้อง join 5 ตารางพร้อมกัน
 * และต้องรวมช่วงเวลาหลายแถวให้เหลือบรรทัดเดียวต่อคน
 *
 * ⚠️ ทุกค่าที่มาจากผู้ใช้ผูกผ่าน parameter ของ sql`` เสมอ
 *    ห้ามต่อสตริงเข้าไปในคำสั่ง SQL ตรง ๆ เพราะจะเปิดช่อง SQL injection
 *    ยกเว้นชื่อคอลัมน์สำหรับเรียงลำดับ ซึ่งถูกจำกัดด้วย whitelist ด้านล่าง
 */

export type RegistrationFilter = {
  q?: string;
  /** in = เช็คอินแล้ว · out = ยังไม่มา · cancelled = ยกเลิก */
  checkin?: string;
  sessionId?: string;
  emailStatus?: string;
  source?: string;
  occupation?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: number;
  perPage?: number;
};

export type RegistrationRow = {
  id: string;
  registrationCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupation: string | null;
  status: string;
  source: string;
  createdAt: Date;
  sessionNames: string | null;
  checkedInCount: number;
  emailStatus: string | null;
  shareLinkLabel: string | null;
};

/** คอลัมน์ที่ยอมให้เรียงได้ — กัน SQL injection ผ่านพารามิเตอร์ sort */
const DEFAULT_SORT = "r.created_at";
const SORTABLE: Record<string, string> = {
  created: "r.created_at",
  name: "r.first_name",
  email: "r.email",
  status: "r.status",
  code: "r.registration_code",
};

function buildWhere(eventId: string, filter: RegistrationFilter) {
  const parts = [sql`r.event_id = ${eventId}`];

  if (filter.q?.trim()) {
    // ค้นคำเดียวให้ครอบทั้ง ชื่อ นามสกุล อีเมล เบอร์ และรหัสลงทะเบียน
    // เบอร์โทรตัดขีดออกก่อนเทียบ เพราะคนกรอกมาทั้งแบบมีขีดและไม่มีขีด
    const term = `%${filter.q.trim().toLowerCase()}%`;
    const digits = filter.q.replace(/\D/g, "");
    parts.push(sql`(
      lower(r.first_name) like ${term}
      or lower(r.last_name) like ${term}
      or lower(r.first_name || ' ' || r.last_name) like ${term}
      or lower(r.email) like ${term}
      or lower(r.registration_code) like ${term}
      ${digits ? sql`or replace(replace(r.phone, '-', ''), ' ', '') like ${`%${digits}%`}` : sql``}
    )`);
  }

  if (filter.checkin === "in") {
    parts.push(sql`exists (
      select 1 from tickets t join check_ins ci on ci.ticket_id = t.id
      where t.registration_id = r.id
    )`);
  } else if (filter.checkin === "out") {
    parts.push(sql`r.status <> 'cancelled' and not exists (
      select 1 from tickets t join check_ins ci on ci.ticket_id = t.id
      where t.registration_id = r.id
    )`);
  } else if (filter.checkin === "cancelled") {
    parts.push(sql`r.status = 'cancelled'`);
  }

  if (filter.sessionId) {
    parts.push(sql`exists (
      select 1 from registration_sessions rs
      where rs.registration_id = r.id and rs.session_id = ${filter.sessionId}
    )`);
  }

  if (filter.emailStatus) {
    parts.push(sql`exists (
      select 1 from email_logs el
      where el.registration_id = r.id and el.status = ${filter.emailStatus}::email_status
    )`);
  }

  if (filter.source) {
    parts.push(sql`r.source = ${filter.source}::registration_source`);
  }

  if (filter.occupation) {
    parts.push(sql`coalesce(nullif(r.occupation_other,''), r.occupation) = ${filter.occupation}`);
  }

  if (filter.from) {
    parts.push(sql`(r.created_at AT TIME ZONE 'Asia/Bangkok')::date >= ${filter.from}::date`);
  }
  if (filter.to) {
    parts.push(sql`(r.created_at AT TIME ZONE 'Asia/Bangkok')::date <= ${filter.to}::date`);
  }

  return sql.join(parts, sql` and `);
}

export async function listRegistrations(eventId: string, filter: RegistrationFilter) {
  const page = Math.max(1, filter.page ?? 1);
  const perPage = Math.min(200, Math.max(10, filter.perPage ?? 50));
  const offset = (page - 1) * perPage;

  const orderColumn = SORTABLE[filter.sort ?? "created"] ?? DEFAULT_SORT;
  const direction = filter.dir === "asc" ? sql`asc` : sql`desc`;
  const where = buildWhere(eventId, filter);

  const rows = await db.execute<{
    id: string;
    registration_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    occupation: string | null;
    status: string;
    source: string;
    created_at: Date;
    session_names: string | null;
    checked_in_count: number;
    email_status: string | null;
    share_link_label: string | null;
  }>(sql`
    select r.id, r.registration_code, r.first_name, r.last_name, r.email, r.phone,
           coalesce(nullif(r.occupation_other,''), r.occupation) as occupation,
           r.status::text as status, r.source::text as source, r.created_at,
           (select string_agg(es.name_th, ' + ' order by es.sort_order)
              from registration_sessions rs
              join event_sessions es on es.id = rs.session_id
             where rs.registration_id = r.id) as session_names,
           (select count(*)::int from tickets t
              join check_ins ci on ci.ticket_id = t.id
             where t.registration_id = r.id) as checked_in_count,
           (select el.status::text from email_logs el
             where el.registration_id = r.id
             order by el.created_at desc limit 1) as email_status,
           (select sl.label from share_links sl where sl.id = r.share_link_id) as share_link_label
    from registrations r
    where ${where}
    order by ${sql.raw(orderColumn)} ${direction}
    limit ${perPage} offset ${offset}
  `);

  const countRows = await db.execute<{ total: number }>(sql`
    select count(*)::int as total from registrations r where ${where}
  `);

  const items: RegistrationRow[] = rows.map((r) => ({
    id: r.id,
    registrationCode: r.registration_code,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    occupation: r.occupation,
    status: r.status,
    source: r.source,
    createdAt: new Date(r.created_at),
    sessionNames: r.session_names,
    checkedInCount: Number(r.checked_in_count),
    emailStatus: r.email_status,
    shareLinkLabel: r.share_link_label,
  }));

  const total = Number(countRows[0]?.total ?? 0);
  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** ดึงทุกแถวที่ตรงตัวกรอง — ใช้ตอน export ซึ่งต้องได้ครบ ไม่แบ่งหน้า */
export async function listRegistrationsForExport(eventId: string, filter: RegistrationFilter) {
  const { items } = await listRegistrations(eventId, { ...filter, page: 1, perPage: 100000 });
  return items;
}

/** รายชื่ออาชีพที่มีอยู่จริง — ใช้เติมตัวเลือกในกล่องกรอง */
export async function listOccupations(eventId: string): Promise<string[]> {
  const rows = await db.execute<{ value: string }>(sql`
    select distinct coalesce(nullif(r.occupation_other,''), r.occupation) as value
    from registrations r
    where r.event_id = ${eventId}
      and coalesce(nullif(r.occupation_other,''), r.occupation) is not null
    order by 1
  `);
  return rows.map((r) => r.value);
}

/* ------------------------------------------------------------------ */
/* รายละเอียดรายบุคคล                                                  */
/* ------------------------------------------------------------------ */

export async function getRegistrationDetail(eventId: string, id: string) {
  const rows = await db.execute<Record<string, never>>(sql`
    select r.* from registrations r where r.id = ${id} and r.event_id = ${eventId}
  `);
  const row = rows[0] as
    | {
        id: string;
        registration_code: string;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        occupation: string | null;
        occupation_other: string | null;
        status: string;
        source: string;
        locale: string;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        share_link_id: string | null;
        created_at: Date;
        cancelled_at: Date | null;
        cancel_reason: string | null;
      }
    | undefined;
  if (!row) return null;

  const sessions = await db.execute<{ id: string; name_th: string; checked_in_at: Date | null }>(sql`
    select es.id, es.name_th,
           (select ci.checked_in_at from tickets t
              join check_ins ci on ci.ticket_id = t.id and ci.session_id = es.id
             where t.registration_id = r.id limit 1) as checked_in_at
    from registration_sessions rs
    join event_sessions es on es.id = rs.session_id
    join registrations r on r.id = rs.registration_id
    where rs.registration_id = ${id}
    order by es.sort_order
  `);

  const answers = await db.execute<{ question: string; answer: string }>(sql`
    select fq.label_th as question,
           coalesce(fo.label_th, ra.value_text, '-') as answer
    from registration_answers ra
    join form_questions fq on fq.id = ra.question_id
    left join form_options fo on fo.id = ra.option_id
    where ra.registration_id = ${id}
    order by fq.sort_order
  `);

  const emails = await db.execute<{
    id: number;
    template: string;
    status: string;
    attempt_count: number;
    last_error: string | null;
    sent_at: Date | null;
    created_at: Date;
  }>(sql`
    select el.id, el.template, el.status::text as status, el.attempt_count,
           el.last_error, el.sent_at, el.created_at
    from email_logs el where el.registration_id = ${id}
    order by el.created_at desc
  `);

  const consentRows = await db.execute<{
    type: string;
    is_granted: boolean;
    policy_version: string;
    consented_at: Date;
  }>(sql`
    select c.type::text as type, c.is_granted, c.policy_version, c.consented_at
    from consents c where c.registration_id = ${id}
    order by c.consented_at
  `);

  const ticketRows = await db.execute<{ id: string; ticket_code: string; qr_token: string; status: string }>(sql`
    select t.id, t.ticket_code, t.qr_token, t.status::text as status
    from tickets t where t.registration_id = ${id}
  `);

  return { registration: row, sessions, answers, emails, consents: consentRows, tickets: ticketRows };
}

/* ------------------------------------------------------------------ */
/* คำตอบของคำถามเพิ่มเติม — ใช้ตอน export                              */
/* ------------------------------------------------------------------ */

/**
 * ดึงคำตอบทุกข้อของทุกคนในครั้งเดียว แล้วจัดเป็น map
 *
 * ทำแบบนี้แทนการ query ทีละคน เพราะไฟล์ export อาจมีหลายพันแถว
 * ถ้าดึงทีละคนจะยิง query หลายพันครั้งจนหมดเวลา
 */
export async function getAnswersForExport(eventId: string) {
  const questions = await db.execute<{ id: string; key: string; label_th: string }>(sql`
    select fq.id, fq.key, fq.label_th
    from form_questions fq
    where fq.event_id = ${eventId} and fq.is_active = true
    order by fq.sort_order
  `);

  const answers = await db.execute<{
    registration_id: string;
    question_id: string;
    answer: string;
  }>(sql`
    select ra.registration_id, ra.question_id,
           coalesce(fo.label_th, ra.value_text, '') as answer
    from registration_answers ra
    join registrations r on r.id = ra.registration_id
    left join form_options fo on fo.id = ra.option_id
    where r.event_id = ${eventId}
  `);

  const byRegistration = new Map<string, Map<string, string[]>>();
  for (const row of answers) {
    let perQuestion = byRegistration.get(row.registration_id);
    if (!perQuestion) {
      perQuestion = new Map();
      byRegistration.set(row.registration_id, perQuestion);
    }
    const list = perQuestion.get(row.question_id) ?? [];
    if (row.answer) list.push(row.answer);
    perQuestion.set(row.question_id, list);
  }

  return {
    questions: questions.map((q) => ({ id: q.id, key: q.key, label: q.label_th })),
    /** คำตอบแบบเลือกหลายข้อจะถูกรวมเป็นข้อความเดียวคั่นด้วยจุลภาค */
    valueFor(registrationId: string, questionId: string): string {
      return (byRegistration.get(registrationId)?.get(questionId) ?? []).join(", ");
    },
  };
}
