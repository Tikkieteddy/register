import type { Metadata } from "next";
import Link from "next/link";
import { SwitchEventButton } from "@/components/admin/events/EventSwitcher";
import { NewEventForm } from "@/components/admin/events/NewEventForm";
import { Card, CardBody } from "@/components/ui/Card";
import { getAdminEvent, listAdminEvents } from "@/lib/admin/current-event";
import { formatDateRange } from "@/lib/datetime";

export const metadata: Metadata = { title: "จัดการงาน" };

/**
 * หน้าจัดการงานทั้งหมด — ดูรายการงาน สลับงานที่ทำอยู่ และสร้างงานใหม่
 *
 * ระบบรองรับหลายงานพร้อมกัน หน้านี้จึงเป็นจุดเดียวที่เห็นภาพรวมว่ามีงานอะไรบ้าง
 * และงานไหนเผยแพร่แล้วหรือยังเป็นฉบับร่าง
 */
export default async function AdminEventsPage() {
  const [all, current] = await Promise.all([listAdminEvents(), getAdminEvent()]);

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-ink">จัดการงาน</h1>
        <p className="text-sm text-muted">
          ระบบเดียวรองรับได้หลายงาน — แต่ละงานมีที่นั่ง ฟอร์ม ลิงก์ติดตามผล และรายชื่อผู้ลงทะเบียนแยกจากกัน
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          งานทั้งหมด <span className="text-sm font-normal text-muted tabular-nums">({all.length})</span>
        </h2>

        {all.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีงานในระบบ — สร้างงานแรกได้จากแบบฟอร์มด้านล่าง</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {all.map((event) => (
              <li key={event.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink">{event.nameTh}</span>
                        <StatusBadge status={event.status} />
                        {event.id === current?.id && (
                          <span className="text-xs px-2 py-0.5 rounded-[var(--radius-pill)] bg-primary-light text-primary-dark font-semibold">
                            กำลังจัดการอยู่
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted mt-0.5">
                        <span className="font-mono">/e/{event.slug}</span>
                        <span className="mx-2" aria-hidden="true">
                          ·
                        </span>
                        {formatDateRange(event.startsAt, event.startsAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/e/${event.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted hover:text-primary-dark"
                      >
                        ดูหน้าเว็บ ↗
                      </Link>
                      {event.id !== current?.id && <SwitchEventButton slug={event.slug} />}
                    </div>
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
