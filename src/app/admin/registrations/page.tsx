import Link from "next/link";
import { FilterBar } from "@/components/admin/FilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { RegistrationsTable, type Row } from "@/components/admin/RegistrationsTable";
import { db } from "@/db";
import { eventSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import {
  listOccupations,
  listRegistrations,
  type RegistrationFilter,
} from "@/lib/admin/registrations";
import { recordAudit } from "@/lib/audit";
import { formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata = { title: "ผู้ลงทะเบียน" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const event = await getAdminEvent(one(params, "event"));

  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const filter: RegistrationFilter = {
    q: one(params, "q"),
    checkin: one(params, "checkin"),
    sessionId: one(params, "session"),
    emailStatus: one(params, "email"),
    source: one(params, "source"),
    occupation: one(params, "occupation"),
    from: one(params, "from"),
    to: one(params, "to"),
    sort: one(params, "sort"),
    dir: one(params, "dir"),
    page: Number(one(params, "page") ?? 1) || 1,
  };

  const [result, sessions, occupations] = await Promise.all([
    listRegistrations(event.id, filter),
    db
      .select({ id: eventSessions.id, nameTh: eventSessions.nameTh })
      .from(eventSessions)
      .where(eq(eventSessions.eventId, event.id))
      .orderBy(eventSessions.sortOrder),
    listOccupations(event.id),
  ]);

  // ⚠️ ข้อกำหนด PDPA — การเปิดดูรายชื่อผู้ลงทะเบียนถือเป็นการเข้าถึงข้อมูลส่วนบุคคล
  await recordAudit({
    userId: admin.id,
    action: "view_list",
    entityType: "registration",
    entityId: event.id,
    after: { matched: result.total, filter },
  });

  const rows: Row[] = result.items.map((item) => ({
    id: item.id,
    registrationCode: item.registrationCode,
    fullName: `${item.firstName} ${item.lastName}`,
    email: item.email,
    phone: item.phone,
    sessionNames: item.sessionNames,
    status: item.status,
    source: item.source,
    checkedInCount: item.checkedInCount,
    emailStatus: item.emailStatus,
    createdAtLabel: `${formatThaiDate(item.createdAt)} ${formatTime(item.createdAt)}`,
  }));

  // สร้าง query string ของตัวกรองปัจจุบัน เพื่อให้ Export ใช้เงื่อนไขชุดเดียวกัน
  const filterQuery = new URLSearchParams(
    Object.entries({
      event: event.slug,
      q: filter.q,
      checkin: filter.checkin,
      session: filter.sessionId,
      email: filter.emailStatus,
      source: filter.source,
      occupation: filter.occupation,
      from: filter.from,
      to: filter.to,
    }).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

  function pageHref(page: number): string {
    const next = new URLSearchParams(filterQuery);
    next.delete("event");
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    return qs ? `/admin/registrations?${qs}` : "/admin/registrations";
  }

  const exportButton =
    "min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">รายชื่อผู้ลงทะเบียน</h1>
          <p className="text-sm text-muted">
            ตัวกรองที่ตั้งไว้บนหน้าจอจะถูกใช้กับไฟล์ที่ Export ด้วย
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/admin/export?format=xlsx&${filterQuery}`} className={exportButton}>
            Excel (.xlsx)
          </a>
          <a href={`/api/admin/export?format=csv&${filterQuery}`} className={exportButton}>
            CSV
          </a>
          <Link href="/admin/report" className={exportButton}>
            รายงาน PDF
          </Link>
          <Link
            href="/admin/registrations/new"
            className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark"
          >
            เพิ่มด้วยมือ
          </Link>
        </div>
      </header>

      <div className="bg-surface border border-line rounded-[var(--radius-card)] p-4">
        <FilterBar
          total={result.total}
          occupations={occupations}
          sessions={sessions.map((s) => ({ value: s.id, label: s.nameTh }))}
        />
      </div>

      <RegistrationsTable rows={rows} filterQuery={filterQuery} />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        perPage={result.perPage}
        makeHref={pageHref}
      />

      <p className="text-xs text-muted">
        ⚠️ ไฟล์ที่ Export มีข้อมูลส่วนบุคคล — ห้ามส่งต่อทางแชทสาธารณะ
        และทุกครั้งที่ Export ระบบบันทึกไว้ว่าใครดึงข้อมูลออกไปกี่รายการ ตามข้อกำหนด PDPA
      </p>
    </div>
  );
}
