import Link from "next/link";
import { notFound } from "next/navigation";
import { RegistrationEditor } from "@/components/admin/RegistrationEditor";
import { db } from "@/db";
import { eventSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { getRegistrationDetail } from "@/lib/admin/registrations";
import { recordAudit } from "@/lib/audit";
import { formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata = { title: "รายละเอียดผู้ลงทะเบียน" };
export const dynamic = "force-dynamic";

const EMAIL_LABEL: Record<string, string> = {
  sent: "ส่งสำเร็จ",
  queued: "รอส่ง",
  failed: "ส่งไม่สำเร็จ",
  bounced: "ตีกลับ",
  complained: "ถูกร้องเรียน",
};

const CONSENT_LABEL: Record<string, string> = {
  pdpa: "ยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคล (PDPA)",
  photo: "ยินยอมให้บันทึกภาพและวิดีโอ",
  terms: "ยอมรับเงื่อนไขการเข้าร่วมงาน",
  marketing: "ยินยอมรับข่าวสารการตลาด",
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-[var(--radius-card)] p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const event = await getAdminEvent();
  if (!event) notFound();

  const detail = await getRegistrationDetail(event.id, id);
  if (!detail) notFound();

  const sessions = await db
    .select({ id: eventSessions.id, nameTh: eventSessions.nameTh })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(eventSessions.sortOrder);

  // ⚠️ PDPA — การเปิดดูข้อมูลรายบุคคลถือเป็นการเข้าถึงข้อมูลส่วนบุคคล
  await recordAudit({
    userId: admin.id,
    action: "view_detail",
    entityType: "registration",
    entityId: id,
  });

  const r = detail.registration;
  const cancelled = r.status === "cancelled";
  const ticket = detail.tickets[0];

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <nav className="text-sm">
        <Link href="/admin-cms/registrations" className="text-primary-dark hover:underline">
          ← กลับไปรายชื่อผู้ลงทะเบียน
        </Link>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">
            {r.first_name} {r.last_name}
          </h1>
          <p className="text-sm text-muted tabular-nums">
            รหัสลงทะเบียน {r.registration_code} · ลงทะเบียนเมื่อ{" "}
            {formatThaiDate(new Date(r.created_at))} {formatTime(new Date(r.created_at))}
          </p>
        </div>
        {ticket ? (
          <Link
            href={`/ticket/${ticket.qr_token}`}
            className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2"
          >
            เปิดหน้าตั๋วของผู้ลงทะเบียน
          </Link>
        ) : null}
      </header>

      {cancelled ? (
        <p className="text-sm bg-danger-bg text-danger rounded-[var(--radius-control)] px-3 py-2">
          รายการนี้ถูกยกเลิกแล้ว
          {r.cancelled_at ? ` เมื่อ ${formatThaiDate(new Date(r.cancelled_at))}` : ""}
          {r.cancel_reason ? ` · เหตุผล: ${r.cancel_reason}` : ""} — ที่นั่งถูกคืนเข้าระบบแล้ว
          และ QR เดิมใช้ไม่ได้อีก
        </p>
      ) : null}

      <Panel title="แก้ไขข้อมูล">
        <RegistrationEditor
          id={id}
          isCancelled={cancelled}
          sessions={sessions}
          initial={{
            firstName: r.first_name,
            lastName: r.last_name,
            email: r.email,
            phone: r.phone,
            occupation: r.occupation_other || r.occupation || "",
            sessionIds: detail.sessions.map((s) => s.id),
          }}
        />
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="ประวัติการเช็คอิน">
          {detail.sessions.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่ได้เลือกช่วงเวลา</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-2">{s.name_th}</span>
                  {s.checked_in_at ? (
                    <span className="text-[var(--color-success)] tabular-nums">
                      เช็คอิน {formatTime(new Date(s.checked_in_at))} น. ·{" "}
                      {formatThaiDate(new Date(s.checked_in_at))}
                    </span>
                  ) : (
                    <span className="text-muted">ยังไม่เช็คอิน</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="ที่มาของผู้ลงทะเบียน">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {(
              [
                ["ช่องทาง", r.source === "walkin" ? "ลงทะเบียนหน้างาน" : r.source === "admin_manual" ? "ผู้ดูแลเพิ่มให้" : "ลงทะเบียนออนไลน์"],
                ["utm_source", r.utm_source ?? "-"],
                ["utm_medium", r.utm_medium ?? "-"],
                ["utm_campaign", r.utm_campaign ?? "-"],
                ["ภาษาที่ใช้", r.locale === "en" ? "อังกฤษ" : "ไทย"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="text-ink-2 break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="คำตอบในฟอร์ม">
          {detail.answers.length === 0 ? (
            <p className="text-sm text-muted">ไม่มีคำตอบเพิ่มเติม</p>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              {detail.answers.map((a, index) => (
                <div key={`${a.question}-${index}`}>
                  <dt className="text-xs text-muted">{a.question}</dt>
                  <dd className="text-ink-2">{a.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>

        <Panel title="ประวัติการส่งอีเมล">
          {detail.emails.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีการส่งอีเมล</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.emails.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-2">{e.template}</span>
                    <span
                      className={
                        e.status === "failed" || e.status === "bounced"
                          ? "text-danger font-medium"
                          : "text-[var(--color-success)]"
                      }
                    >
                      {EMAIL_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted tabular-nums">
                    {formatThaiDate(new Date(e.created_at))} {formatTime(new Date(e.created_at))} ·
                    พยายามส่ง {e.attempt_count} ครั้ง
                  </span>
                  {e.last_error ? (
                    <span className="text-xs text-danger break-all">{e.last_error}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="หลักฐานความยินยอม (PDPA)">
          {detail.consents.length === 0 ? (
            <p className="text-sm text-danger">
              ⚠️ ไม่พบหลักฐานความยินยอม — ต้องตรวจสอบก่อนใช้ข้อมูลนี้
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.consents.map((c, index) => (
                <li key={`${c.type}-${index}`} className="flex flex-col">
                  <span className="text-ink-2">
                    {c.is_granted ? "✅" : "❌"} {CONSENT_LABEL[c.type] ?? c.type}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {formatThaiDate(new Date(c.consented_at))}{" "}
                    {formatTime(new Date(c.consented_at))} · นโยบายเวอร์ชัน {c.policy_version}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="ตั๋ว">
          {detail.tickets.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีตั๋ว</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-ink-2 tabular-nums">{t.ticket_code}</span>
                  <span className={t.status === "void" ? "text-danger" : "text-muted"}>
                    {t.status === "void" ? "ยกเลิกแล้ว" : t.status === "used" ? "ใช้แล้ว" : "ใช้งานได้"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            QR ของตั๋วเป็นรหัสสุ่มล้วน ไม่มีชื่อ อีเมล หรือเบอร์โทรอยู่ข้างใน
          </p>
        </Panel>
      </div>
    </div>
  );
}
