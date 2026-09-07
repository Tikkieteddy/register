import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { EventInfoForm } from "@/components/admin/settings/EventInfoForm";
import { PrivacyForm } from "@/components/admin/settings/PrivacyForm";
import { QuestionsPanel, type QuestionRow } from "@/components/admin/settings/QuestionsPanel";
import { QuotaForm } from "@/components/admin/settings/QuotaForm";
import { UsersPanel, type UserRow } from "@/components/admin/settings/UsersPanel";
import { db } from "@/db";
import { eventSessions, users } from "@/db/schema";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata = { title: "ตั้งค่างาน" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "info", label: "ข้อมูลงาน" },
  { key: "quota", label: "ที่นั่งและโควตา" },
  { key: "questions", label: "คำถามในฟอร์ม" },
  { key: "users", label: "ผู้ใช้งาน" },
  { key: "privacy", label: "ความเป็นส่วนตัว" },
] as const;

/** แปลงเวลาเป็นรูปแบบที่ช่อง datetime-local ใช้ได้ โดยยึดเวลาไทยเสมอ */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T");
}

const CONSENT_LABEL: Record<string, string> = {
  pdpa: "ยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคล (PDPA)",
  photo: "ยินยอมให้บันทึกภาพและวิดีโอ",
  terms: "ยอมรับเงื่อนไขการเข้าร่วมงาน",
  marketing: "ยินยอมรับข่าวสารการตลาด",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const active = TABS.find((t) => t.key === params.tab)?.key ?? "info";

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">ตั้งค่างาน</h1>
        <p className="text-sm text-muted">{event.nameTh}</p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/settings?tab=${tab.key}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] text-sm border ${
              active === tab.key
                ? "border-primary bg-primary-light text-primary-dark font-semibold"
                : "border-line text-ink-2 hover:bg-surface-2"
            }`}
          >
            {tab.label}
          </Link>
        ))}
        <Link
          href="/admin/media"
          className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] text-sm border border-line text-ink-2 hover:bg-surface-2"
        >
          ภาพและสื่อ ↗
        </Link>
        <Link
          href="/admin/links"
          className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] text-sm border border-line text-ink-2 hover:bg-surface-2"
        >
          ลิงก์ติดตามผล ↗
        </Link>
      </nav>

      {active === "info" ? (
        <EventInfoForm
          id={event.id}
          initial={{
            nameTh: event.nameTh,
            nameEn: event.nameEn ?? "",
            descriptionTh: event.descriptionTh ?? "",
            venueName: event.venueName ?? "",
            venueAddress: event.venueAddress ?? "",
            mapUrl: event.mapUrl ?? "",
            travelNote: event.travelNote ?? "",
            organizerName: event.organizerName ?? "",
            organizerPhone: event.organizerPhone ?? "",
            organizerEmail: event.organizerEmail ?? "",
            organizerLineId: event.organizerLineId ?? "",
          }}
        />
      ) : null}

      {active === "quota" ? await renderQuota(event) : null}
      {active === "questions" ? await renderQuestions(event.id) : null}
      {active === "users" ? await renderUsers(admin.id) : null}
      {active === "privacy" ? await renderPrivacy(event.id, event.privacyPolicyVersion) : null}
    </div>
  );
}

async function renderQuota(event: Awaited<ReturnType<typeof getAdminEvent>>) {
  if (!event) return null;
  const sessions = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(asc(eventSessions.sortOrder));

  return (
    <QuotaForm
      eventId={event.id}
      initial={{
        sessions: sessions.map((s) => ({
          id: s.id,
          nameTh: s.nameTh,
          quota: s.quota,
          reservedCount: s.reservedCount,
          checkedInCount: s.checkedInCount,
          isClosed: s.isClosed,
        })),
        seatHoldMinutes: event.seatHoldMinutes,
        allowWalkinOverQuota: event.allowWalkinOverQuota,
        waitlistEnabled: event.waitlistEnabled,
        status: event.status,
        registrationOpensAt: toLocalInput(event.registrationOpensAt),
        registrationClosesAt: toLocalInput(event.registrationClosesAt),
      }}
    />
  );
}

async function renderQuestions(eventId: string) {
  const rows = await db.execute<{
    id: string;
    key: string;
    label_th: string;
    helper_text_th: string | null;
    type: string;
    is_required: boolean;
    is_active: boolean;
    min_select: number | null;
    max_select: number | null;
    answer_count: number;
  }>(sql`
    select fq.id, fq.key, fq.label_th, fq.helper_text_th, fq.type::text as type,
           fq.is_required, fq.is_active, fq.min_select, fq.max_select,
           (select count(*)::int from registration_answers ra where ra.question_id = fq.id) as answer_count
    from form_questions fq
    where fq.event_id = ${eventId}
    order by fq.sort_order
  `);

  const optionRows = await db.execute<{
    id: string;
    question_id: string;
    value: string;
    label_th: string;
    is_active: boolean;
    sort_order: number;
    answer_count: number;
  }>(sql`
    select fo.id, fo.question_id, fo.value, fo.label_th, fo.is_active, fo.sort_order,
           (select count(*)::int from registration_answers ra where ra.option_id = fo.id) as answer_count
    from form_options fo
    join form_questions fq on fq.id = fo.question_id
    where fq.event_id = ${eventId}
    order by fo.sort_order
  `);

  const questions: QuestionRow[] = rows.map((q) => ({
    id: q.id,
    key: q.key,
    labelTh: q.label_th,
    helperTextTh: q.helper_text_th,
    type: q.type,
    isRequired: q.is_required,
    isActive: q.is_active,
    minSelect: q.min_select,
    maxSelect: q.max_select,
    answerCount: Number(q.answer_count),
    options: optionRows
      .filter((o) => o.question_id === q.id)
      .map((o) => ({
        id: o.id,
        value: o.value,
        labelTh: o.label_th,
        isActive: o.is_active,
        sortOrder: o.sort_order,
        answerCount: Number(o.answer_count),
      })),
  }));

  return <QuestionsPanel questions={questions} />;
}

async function renderUsers(currentUserId: string) {
  const rows = await db.select().from(users).orderBy(asc(users.email));
  const now = new Date();

  const list: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    canScan: u.canScan,
    isActive: u.isActive,
    isLocked: Boolean(u.lockedUntil && u.lockedUntil > now),
    lastLoginLabel: u.lastLoginAt
      ? `${formatThaiDate(u.lastLoginAt)} ${formatTime(u.lastLoginAt)}`
      : "ยังไม่เคยเข้าระบบ",
  }));

  return <UsersPanel users={list} currentUserId={currentUserId} />;
}

async function renderPrivacy(eventId: string, policyVersion: string) {
  const rows = await db.execute<{ type: string; granted: number; total: number }>(sql`
    select c.type::text as type,
           count(*) filter (where c.is_granted)::int as granted,
           count(*)::int as total
    from consents c
    join registrations r on r.id = c.registration_id
    where r.event_id = ${eventId}
    group by 1
    order by 1
  `);

  return (
    <PrivacyForm
      eventId={eventId}
      policyVersion={policyVersion}
      consentSummary={rows.map((row) => ({
        type: row.type,
        label: CONSENT_LABEL[row.type] ?? row.type,
        granted: Number(row.granted),
        total: Number(row.total),
      }))}
    />
  );
}
