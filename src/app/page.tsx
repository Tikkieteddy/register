import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getFeaturedEvent, listPublishedEvents, type EventCard, type RegistrationState } from "@/db/queries";
import { formatDateRange, formatTimeRange } from "@/lib/datetime";

/**
 * หน้าแรก — รวมงานทั้งหมดที่เปิดให้ลงทะเบียน
 *
 * ระบบนี้รองรับหลายงานพร้อมกัน หน้านี้จึงเป็นทางเข้ากลาง
 * แยกเป็น 2 กลุ่มเพราะคนที่เข้ามาส่วนใหญ่มาเพื่อ "ลงทะเบียน" ไม่ใช่มาดูประวัติ
 * งานที่ยังเปิดรับจึงต้องอยู่บนสุดเสมอ ส่วนงานที่จบแล้วเก็บไว้ล่างเพื่อความน่าเชื่อถือ
 */

const SITE_NAME = "ระบบรับลงทะเบียนเข้าร่วมงาน";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "รวมงานที่เปิดรับลงทะเบียน เลือกงานที่ต้องการเข้าร่วมเพื่อดูรายละเอียดและลงทะเบียน",
};

/**
 * ไม่เก็บหน้านี้เป็นไฟล์นิ่ง เพราะที่นั่งคงเหลือเปลี่ยนตลอดเวลา
 * ถ้าแคชไว้ คนจะเห็นตัวเลขที่นั่งผิดแล้วกดเข้าไปเจอว่าเต็มแล้ว
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [events, featured] = await Promise.all([listPublishedEvents(), getFeaturedEvent()]);

  const upcoming = events
    .filter((event) => !event.hasEnded)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = events.filter((event) => event.hasEnded);

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <SiteHeader siteName={SITE_NAME} eventSlug={featured?.slug} />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <span
            className="self-start inline-flex items-center gap-2 px-3 py-1 rounded-[var(--radius-pill)]
              bg-primary-light text-primary-dark text-xs font-semibold tracking-wide"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[color:var(--color-primary)]" />
            เปิดรับลงทะเบียนออนไลน์
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink text-balance tracking-tight">
            งานทั้งหมด
          </h1>
          <p className="text-ink-2 max-w-[60ch] text-[15px] sm:text-base">
            เลือกงานที่ต้องการเข้าร่วม เพื่อดูรายละเอียดและลงทะเบียน
            ระบบจะส่ง QR Code สำหรับเข้างานไปที่อีเมลของคุณ
          </p>
        </section>

        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
              <SectionHeading id="upcoming-heading" count={upcoming.length}>
                กำลังเปิดรับสมัคร
              </SectionHeading>

              {upcoming.length === 0 ? (
                <p className="text-muted text-sm">
                  ยังไม่มีงานที่เปิดรับลงทะเบียนในขณะนี้ โปรดติดตามประกาศอีกครั้ง
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((event) => (
                    <EventTile key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </section>

            {past.length > 0 && (
              <section aria-labelledby="past-heading" className="flex flex-col gap-4">
                <SectionHeading id="past-heading" count={past.length}>
                  งานที่ผ่านมา
                </SectionHeading>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {past.map((event) => (
                    <EventTile key={event.id} event={event} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <SiteFooter siteName={SITE_NAME} eventSlug={featured?.slug} />
    </div>
  );
}

function SectionHeading({
  id,
  count,
  children,
}: {
  id: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-line pb-2">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {children}
      </h2>
      <span className="text-sm text-muted tabular-nums">{count} งาน</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-8 sm:p-10 text-center flex flex-col gap-2">
      <p className="text-lg font-semibold text-ink">ยังไม่มีงานที่เผยแพร่</p>
      <p className="text-ink-2 max-w-[52ch] mx-auto">
        ผู้ดูแลระบบสามารถสร้างงานใหม่และเปลี่ยนสถานะเป็น “เผยแพร่แล้ว” เพื่อให้งานปรากฏบนหน้านี้
      </p>
      <Link
        href="/admin-cms/events"
        className="self-center mt-2 inline-flex items-center min-h-11 px-6 rounded-[var(--radius-pill)]
          border border-primary text-primary-dark hover:bg-primary-light transition-colors"
      >
        ไปที่หน้าจัดการงาน
      </Link>
    </div>
  );
}

/** ข้อความและสีของป้ายสถานะ — คุมไว้ที่เดียวเพื่อให้ทุกการ์ดใช้เกณฑ์เดียวกัน */
const STATE_BADGE: Record<RegistrationState, { label: string; className: string }> = {
  open: { label: "เปิดรับลงทะเบียน", className: "bg-primary-light text-primary-dark" },
  not_open_yet: { label: "ยังไม่เปิดรับ", className: "bg-surface-2 text-ink-2" },
  sold_out: { label: "ที่นั่งเต็มแล้ว", className: "bg-surface-2 text-muted" },
  closed: { label: "ปิดรับลงทะเบียน", className: "bg-surface-2 text-muted" },
};

function EventTile({ event }: { event: EventCard }) {
  const badge = STATE_BADGE[event.registrationState];

  return (
    <li>
      <Link
        href={`/e/${event.slug}`}
        className="group h-full flex flex-col rounded-[var(--radius-card)] border border-line bg-surface
          overflow-hidden transition-all duration-200 hover:border-primary
          hover:shadow-[0_8px_24px_-12px_rgba(28,23,20,0.25)] hover:-translate-y-0.5
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
      >
        {/* แถบสีประจำงาน — ใช้สีที่ผู้ดูแลตั้งไว้ให้แต่ละงานต่างกันได้ */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full"
          style={{ backgroundColor: event.hasEnded ? "var(--color-line-strong)" : event.themeColor }}
        />

        <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-ink leading-snug text-balance group-hover:text-primary-dark">
              {event.nameTh}
            </h3>
            <span
              className={`shrink-0 text-xs px-2.5 py-1 rounded-[var(--radius-pill)] ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <dl className="flex flex-col gap-1 text-sm text-ink-2">
            <div className="flex gap-2">
              <dt className="text-muted shrink-0" aria-label="วันที่">
                📅
              </dt>
              <dd>{formatDateRange(event.startsAt, event.endsAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted shrink-0" aria-label="เวลา">
                🕐
              </dt>
              <dd>{formatTimeRange(event.startsAt, event.endsAt)}</dd>
            </div>
            {event.venueName && (
              <div className="flex gap-2">
                <dt className="text-muted shrink-0" aria-label="สถานที่">
                  📍
                </dt>
                <dd>{event.venueName}</dd>
              </div>
            )}
          </dl>

          <p className="mt-auto pt-1 text-sm">
            {event.registrationState === "open" ? (
              <span className="text-ink-2 tabular-nums">
                เหลือ <span className="font-semibold text-ink">{event.totalRemaining}</span> ที่นั่ง
                จากทั้งหมด {event.totalQuota}
              </span>
            ) : (
              <span className="text-muted">ดูรายละเอียดงาน</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}
