import type { Metadata } from "next";
import Link from "next/link";
import { EnterEventButton } from "@/components/admin/events/EnterEventButton";
import { NewEventForm } from "@/components/admin/events/NewEventForm";
import { Card, CardBody } from "@/components/ui/Card";
import { getAdminEvent, listAdminEventSummaries } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { formatDateRange } from "@/lib/datetime";

export const metadata: Metadata = { title: "งานทั้งหมด" };

/** ตัวเลขผู้ลงทะเบียนขยับตลอด โดยเฉพาะช่วงเปิดรับ จึงห้ามแคช */
export const dynamic = "force-dynamic";

/**
 * หน้าแรกของหลังบ้าน — รายการงานทั้งหมดพร้อมตัวเลขสรุป
 *
 * เดิมหน้าแรกคือ Dashboard ของงานใดงานหนึ่ง ผู้ดูแลที่มีหลายงานจึงต้องเดาเอง
 * ว่าตอนนี้กำลังดูงานไหนอยู่ แล้วไปสลับที่ช่องเลือกงานมุมซ้ายบน
 * ตอนนี้เห็นทุกงานพร้อมตัวเลขในหน้าเดียว แล้วค่อยเลือกเข้าไปทีละงาน
 *
 * ⚠️ หน้านี้แทนหน้า "จัดการงาน" เดิมที่ /admin-cms/events ซึ่งแสดงรายการเดียวกัน
 *    การมีสองหน้าที่ลิสต์งานเหมือนกันทำให้คนใช้งานสับสนว่าต่างกันตรงไหน
 *    ที่อยู่เดิมจึงพากลับมาที่นี่แทน
 */
export default async function AdminHomePage() {
  await requireAdmin();
  const [all, current] = await Promise.all([listAdminEventSummaries(), getAdminEvent()]);

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-ink">งานทั้งหมด</h1>
        <p className="text-sm text-muted">
          เลือกงานที่ต้องการจัดการ — แต่ละงานมีที่นั่ง ฟอร์ม ลิงก์ติดตามผล
          และรายชื่อผู้ลงทะเบียนแยกจากกันโดยสิ้นเชิง
        </p>
      </header>

      <section className="flex flex-col gap-3" data-tour="cms-event-list">
        <h2 className="text-lg font-semibold text-ink">
          มีทั้งหมด{" "}
          <span className="text-sm font-normal text-muted tabular-nums">({all.length} งาน)</span>
        </h2>

        {all.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีงานในระบบ — สร้างงานแรกได้จากแบบฟอร์มด้านล่าง</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {all.map((event) => (
              <li key={event.id}>
                <Card>
                  <CardBody className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink">{event.nameTh}</span>
                          <StatusBadge status={event.status} />
                          {event.id === current?.id && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-[var(--radius-pill)]
                                bg-primary-light text-primary-dark font-semibold"
                            >
                              กำลังจัดการอยู่
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted mt-0.5">
                          {formatDateRange(event.startsAt, event.startsAt)}
                          <span className="mx-2" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono">/e/{event.slug}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Link
                          href={`/e/${event.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted hover:text-primary-dark"
                        >
                          ดูหน้าเว็บ ↗
                        </Link>
                        <EnterEventButton slug={event.slug} isCurrent={event.id === current?.id} />
                      </div>
                    </div>

                    <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3">
                      <Stat label="ลงทะเบียนแล้ว" value={event.registrationCount} unit="คน" />
                      <Stat label="ที่นั่งคงเหลือ" value={event.seatsLeft} unit="ที่" />
                      <Stat label="ที่นั่งทั้งหมด" value={event.quotaTotal} unit="ที่" muted />
                    </dl>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">สร้างงานใหม่</h2>
        <Card>
          <CardBody>
            <NewEventForm />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

/** ตัวเลขสรุปหนึ่งช่อง — tabular-nums เพื่อให้หลักของตัวเลขตรงกันทุกการ์ด */
function Stat({
  label,
  value,
  unit,
  muted = false,
}: {
  label: string;
  value: number;
  unit: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${muted ? "text-ink-2" : "text-ink"}`}>
        {value.toLocaleString("th-TH")}
        <span className="text-xs font-normal text-muted ms-1">{unit}</span>
      </dd>
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: "ฉบับร่าง", className: "bg-surface-2 text-ink-2" },
  published: { label: "เผยแพร่แล้ว", className: "bg-primary-light text-primary-dark" },
  closed: { label: "ปิดรับแล้ว", className: "bg-surface-2 text-muted" },
  archived: { label: "เก็บเข้าคลัง", className: "bg-surface-2 text-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_LABEL[status] ?? { label: status, className: "bg-surface-2 text-muted" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-pill)] ${badge.className}`}>
      {badge.label}
    </span>
  );
}
