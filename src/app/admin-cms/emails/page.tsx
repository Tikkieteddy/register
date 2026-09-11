import Link from "next/link";
import { sql } from "drizzle-orm";
import { EmailTools } from "@/components/admin/EmailTools";
import { db } from "@/db";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { formatThaiDate, formatTime } from "@/lib/datetime";
import { isEmailConfigured } from "@/lib/email/sender";

export const metadata = { title: "จัดการอีเมล" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; icon: string; advice: string; tone: string }> = {
  queued: { label: "รอส่ง", icon: "🕐", advice: "รอสักครู่", tone: "text-muted" },
  sent: { label: "ส่งสำเร็จ", icon: "✅", advice: "-", tone: "text-[var(--color-success)]" },
  failed: {
    label: "ส่งไม่สำเร็จ",
    icon: "❌",
    advice: "กดส่งซ้ำ · ถ้ายังไม่ได้ให้โทรหาผู้ลงทะเบียน",
    tone: "text-danger",
  },
  bounced: {
    label: "ตีกลับ",
    icon: "↩️",
    advice: "อีเมลไม่มีอยู่จริงหรือกล่องเต็ม — ขออีเมลใหม่แล้วแก้ในระบบ",
    tone: "text-danger",
  },
  complained: {
    label: "ถูกร้องเรียน",
    icon: "⚠️",
    advice: "ผู้รับกดว่าเป็นสแปม — ห้ามส่งซ้ำ",
    tone: "text-[var(--color-warning)]",
  },
};

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const statusFilter = params.status;

  const summary = await db.execute<{ status: string; count: number }>(sql`
    select el.status::text as status, count(*)::int as count
    from email_logs el
    join registrations r on r.id = el.registration_id
    where r.event_id = ${event.id}
    group by 1
  `);

  const rows = await db.execute<{
    id: number;
    to_email: string;
    template: string;
    status: string;
    attempt_count: number;
    last_error: string | null;
    created_at: Date;
    registration_id: string | null;
    full_name: string | null;
  }>(sql`
    select el.id, el.to_email, el.template, el.status::text as status,
           el.attempt_count, el.last_error, el.created_at, el.registration_id,
           r.first_name || ' ' || r.last_name as full_name
    from email_logs el
    join registrations r on r.id = el.registration_id
    where r.event_id = ${event.id}
      ${statusFilter ? sql`and el.status = ${statusFilter}::email_status` : sql``}
    order by el.created_at desc
    limit 200
  `);

  const counts = new Map(summary.map((s) => [s.status, Number(s.count)]));
  const failedCount = (counts.get("failed") ?? 0) + (counts.get("bounced") ?? 0);

  const tab = (value: string, label: string, count: number) => (
    <Link
      key={value}
      href={value ? `/admin-cms/emails?status=${value}` : "/admin-cms/emails"}
      className={`min-h-11 inline-flex items-center gap-2 px-4 rounded-[var(--radius-pill)] text-sm border ${
        statusFilter === value || (!statusFilter && !value)
          ? "border-primary bg-primary-light text-primary-dark font-semibold"
          : "border-line text-ink-2 hover:bg-surface-2"
      }`}
    >
      {label}
      <span className="tabular-nums text-xs">{count}</span>
    </Link>
  );

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">จัดการอีเมล</h1>
        <p className="text-sm text-muted">สถานะการส่งอีเมลยืนยันทุกฉบับของงานนี้</p>
      </header>

      <EmailTools
        eventId={event.id}
        defaultEmail={admin.email}
        failedCount={failedCount}
        emailConfigured={isEmailConfigured()}
      />

      <div className="flex flex-wrap gap-2">
        {tab("", "ทั้งหมด", total)}
        {tab("sent", "✅ ส่งสำเร็จ", counts.get("sent") ?? 0)}
        {tab("queued", "🕐 รอส่ง", counts.get("queued") ?? 0)}
        {tab("failed", "❌ ส่งไม่สำเร็จ", counts.get("failed") ?? 0)}
        {tab("bounced", "↩️ ตีกลับ", counts.get("bounced") ?? 0)}
      </div>

      <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-surface">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">ผู้รับ</th>
              <th className="p-3 font-medium">ชนิดอีเมล</th>
              <th className="p-3 font-medium">สถานะ</th>
              <th className="p-3 font-medium">พยายามส่ง</th>
              <th className="p-3 font-medium">เวลา</th>
              <th className="p-3 font-medium">ควรทำอย่างไร</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  ไม่มีอีเมลในหมวดนี้
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const info = STATUS[row.status];
                return (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="p-3">
                      {row.registration_id ? (
                        <Link
                          href={`/admin-cms/registrations/${row.registration_id}`}
                          className="text-ink font-medium hover:text-primary-dark hover:underline"
                        >
                          {row.full_name ?? row.to_email}
                        </Link>
                      ) : (
                        <span className="text-ink">{row.to_email}</span>
                      )}
                      <span className="block text-xs text-muted break-all">{row.to_email}</span>
                    </td>
                    <td className="p-3 text-ink-2 text-xs">{row.template}</td>
                    <td className={`p-3 text-xs font-medium ${info?.tone ?? "text-muted"}`}>
                      {info?.icon} {info?.label ?? row.status}
                      {row.last_error ? (
                        <span className="block text-[11px] text-danger break-all font-normal">
                          {row.last_error}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs text-muted tabular-nums">{row.attempt_count} ครั้ง</td>
                    <td className="p-3 text-xs text-muted tabular-nums whitespace-nowrap">
                      {formatThaiDate(new Date(row.created_at))}{" "}
                      {formatTime(new Date(row.created_at))}
                    </td>
                    <td className="p-3 text-xs text-muted">{info?.advice ?? "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rows.length >= 200 ? (
        <p className="text-xs text-muted">แสดง 200 รายการล่าสุด — ใช้แท็บด้านบนกรองให้แคบลง</p>
      ) : null}
    </div>
  );
}
