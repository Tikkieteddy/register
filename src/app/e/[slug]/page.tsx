import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/landing/ShareButtons";
import { Card, CardBody } from "@/components/ui/Card";
import { getEventBySlug } from "@/db/queries";
import { currentYear, formatDateRange, formatTimeRange } from "@/lib/datetime";
import { clientEnv } from "@/lib/env";
import { getDictionary, isLocale, t, type Locale } from "@/i18n/dictionaries";

/**
 * หน้ารายละเอียดงาน (Event Landing Page) ตามข้อกำหนด D1
 * เรียง 10 ส่วนจากบนลงล่างตามที่ระบุไว้
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    lang?: string;
    ref?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEventBySlug(slug);
  if (!data) return { title: "ไม่พบงานที่ค้นหา" };

  const { event } = data;
  return {
    title: event.nameTh,
    description: event.descriptionTh ?? undefined,
    openGraph: {
      title: event.nameTh,
      description: event.descriptionTh ?? undefined,
      type: "website",
      locale: "th_TH",
    },
  };
}

export default async function EventLandingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { lang, ref, utm_source, utm_medium, utm_campaign } = await searchParams;
  const locale: Locale = lang && isLocale(lang) ? lang : "th";
  const dict = getDictionary(locale);

  const data = await getEventBySlug(slug);
  if (!data) notFound();

  const { event, sessions, totalRemaining, registrationState } = data;
  const name = locale === "en" && event.nameEn ? event.nameEn : event.nameTh;
  const description =
    locale === "en" && event.descriptionEn ? event.descriptionEn : event.descriptionTh;
  const shareUrl = `${clientEnv.NEXT_PUBLIC_SITE_URL}/e/${slug}`;

  /**
   * ⚠️ ต้องส่งพารามิเตอร์ติดตามผลต่อไปหน้าฟอร์มด้วย
   *    ไม่งั้นจะวัดไม่ได้ว่าคนที่ลงทะเบียนสำเร็จมาจากลิงก์ไหน
   *    ซึ่งเป็นข้อมูลที่เก็บย้อนหลังไม่ได้ (หัวข้อ 8.5)
   */
  const registerParams = new URLSearchParams();
  if (locale === "en") registerParams.set("lang", "en");
  if (ref) registerParams.set("ref", ref);
  if (utm_source) registerParams.set("utm_source", utm_source);
  if (utm_medium) registerParams.set("utm_medium", utm_medium);
  if (utm_campaign) registerParams.set("utm_campaign", utm_campaign);
  const registerQuery = registerParams.toString();
  const registerHref = `/e/${slug}/register${registerQuery ? `?${registerQuery}` : ""}`;

  const canRegister = registrationState === "open";
  const almostFull = canRegister && totalRemaining <= Math.max(event.seatHoldMinutes, 10);

  const ctaLabel =
    registrationState === "open"
      ? dict.landing.register
      : registrationState === "sold_out"
        ? dict.landing.soldOut
        : registrationState === "not_open_yet"
          ? dict.landing.notOpenYet
          : dict.landing.closed;

  const morning = sessions.find((s) => s.code === "morning");
  const afternoon = sessions.find((s) => s.code === "afternoon");

  return (
    <div className="min-h-screen">
      {/* ① Header — ติดหน้าจอเวลาเลื่อน */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href={`/e/${slug}`} className="font-[family-name:var(--font-display)] font-bold text-ink">
            {event.organizerName ?? name}
          </Link>
          <nav className="hidden md:flex gap-5 ms-4 text-sm text-muted">
            <a href="#details" className="hover:text-primary-dark">{dict.nav.details}</a>
            <a href="#highlights" className="hover:text-primary-dark">{dict.nav.schedule}</a>
            <a href="#speakers" className="hover:text-primary-dark">{dict.nav.speakers}</a>
            <a href="#venue" className="hover:text-primary-dark">{dict.nav.venue}</a>
            <a href="#contact" className="hover:text-primary-dark">{dict.nav.contact}</a>
          </nav>
          <div className="ms-auto flex items-center gap-2 text-sm">
            <Link
              href={`/e/${slug}?lang=${locale === "th" ? "en" : "th"}`}
              className="px-2.5 py-1 rounded-[var(--radius-pill)] border border-line-strong text-ink-2 hover:border-primary hover:text-primary-dark"
            >
              {locale === "th" ? "EN" : "ไทย"}
            </Link>
            <Link href="/admin" className="text-muted hover:text-primary-dark hidden sm:inline">
              {dict.nav.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-20 flex flex-col gap-8 sm:gap-10">
        {/* ② Hero banner */}
        <section className="mt-6">
          <div className="relative rounded-[var(--radius-card)] overflow-hidden bg-ink aspect-[16/7] flex items-end">
            {/* โปสเตอร์จริงจะมาจาก media_assets ในเฟส 5 — ตอนนี้ใช้พื้นสีธีมแทน */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-dark" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden="true" />
            <h1 className="relative p-5 sm:p-8 text-2xl sm:text-4xl font-bold text-white max-w-3xl">
              {name}
            </h1>
          </div>
        </section>

        {/* ③ แถบข้อมูลย่อ */}
        <section aria-label="ข้อมูลย่อของงาน">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile icon="📅" term="วันที่" value={formatDateRange(event.startsAt, event.endsAt, locale)} />
            <InfoTile icon="🕐" term="เวลา" value={formatTimeRange(event.startsAt, event.endsAt, locale)} />
            <InfoTile icon="📍" term="สถานที่" value={event.venueName ?? "-"} />
            <InfoTile icon="🏷️" term="หมวดหมู่" value={event.category ?? "-"} />
          </dl>
        </section>

        {/* ④ กล่องลงทะเบียน (CTA เด่น) */}
        <section
          aria-label="ลงทะเบียน"
          className="rounded-[var(--radius-card)] border border-[color:var(--color-primary)] bg-primary-light p-5 sm:p-6 flex flex-col gap-3 items-start"
        >
          {canRegister ? (
            <Link
              href={registerHref}
              className="inline-flex items-center justify-center min-h-[var(--control-height)] px-8
                rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold
                font-[family-name:var(--font-display)] hover:bg-primary-dark transition-colors w-full sm:w-auto"
            >
              {ctaLabel}
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <span className="inline-flex items-center justify-center min-h-[var(--control-height)] px-8
                rounded-[var(--radius-pill)] bg-surface-2 text-muted border border-line-strong font-semibold">
                {ctaLabel}
              </span>
              {registrationState === "sold_out" && event.waitlistEnabled && (
                <Link
                  href={`/e/${slug}/waitlist`}
                  className="inline-flex items-center justify-center min-h-[var(--control-height)] px-6
                    rounded-[var(--radius-pill)] border border-primary text-primary-dark hover:bg-surface transition-colors"
                >
                  {dict.landing.notifyMe}
                </Link>
              )}
            </div>
          )}

          {canRegister && (
            <p className="text-sm text-ink-2">
              {almostFull && (
                <span className="text-warning font-semibold me-2">
                  ⚠️ {t(dict.landing.almostFull, { n: totalRemaining })}
                </span>
              )}
              {!almostFull && <span className="me-2">{t(dict.landing.seatsLeft, { n: totalRemaining })}</span>}
              {morning && afternoon && (
                <span className="text-muted">
                  (
                  {t(dict.landing.seatsLeftBySession, {
                    morning: morning.isClosed ? 0 : morning.remaining,
                    afternoon: afternoon.isClosed ? 0 : afternoon.remaining,
                  })}
                  )
                </span>
              )}
            </p>
          )}
          <p className="text-sm text-muted">ลงทะเบียน 1 ครั้ง เข้าร่วมได้ทั้ง 2 ช่วงเวลา</p>
        </section>

        {/* ⑤ รายละเอียดงาน */}
        <section id="details" className="scroll-mt-20">
          <SectionTitle>{dict.nav.details}</SectionTitle>
          <Card>
            <CardBody>
              <p className="text-ink-2 whitespace-pre-line max-w-[68ch]">
                {description ?? "รอข้อมูลรายละเอียดงานจากผู้จัด"}
              </p>
            </CardBody>
          </Card>
        </section>

        {/* ⑥ ไฮไลต์ภายในงาน */}
        <section id="highlights" className="scroll-mt-20">
          <SectionTitle>{dict.landing.highlights}</SectionTitle>
          <p className="text-muted text-sm">รอข้อมูลไฮไลต์และกำหนดการจากผู้จัด</p>
        </section>

        {/* ⑦ วิทยากรเด่น */}
        <section id="speakers" className="scroll-mt-20">
          <SectionTitle>{dict.landing.speakers}</SectionTitle>
          <p className="text-muted text-sm">รอข้อมูลวิทยากรจากผู้จัด</p>
        </section>

        {/* ⑧ สถานที่และแผนที่ */}
        <section id="venue" className="scroll-mt-20">
          <SectionTitle>{dict.landing.venue}</SectionTitle>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="font-semibold text-ink">{event.venueName ?? "-"}</p>
              <p className="text-ink-2 whitespace-pre-line">{event.venueAddress ?? "-"}</p>
              {event.travelNote && <p className="text-ink-2 text-sm">{event.travelNote}</p>}
              {event.mapUrl && (
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start inline-flex items-center min-h-11 px-5 rounded-[var(--radius-pill)]
                    border border-primary text-primary-dark hover:bg-primary-light transition-colors text-sm"
                >
                  {dict.landing.openInMaps} ↗
                </a>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ⑨ ผู้จัดงานและการแชร์ */}
        <section id="contact" className="scroll-mt-20">
          <SectionTitle>{dict.landing.organizer}</SectionTitle>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="font-semibold text-ink">{event.organizerName ?? "-"}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-ink-2 text-sm">
                {event.organizerPhone && <span>โทร. {event.organizerPhone}</span>}
                {event.organizerEmail && <span>{event.organizerEmail}</span>}
                {event.organizerLineId && <span>LINE: {event.organizerLineId}</span>}
              </div>
              <hr className="border-line" />
              <ShareButtons
                eventId={event.id}
                url={shareUrl}
                title={name}
                sourcePage="landing"
                label={dict.landing.share}
                copiedLabel={dict.landing.shareCopied}
              />
            </CardBody>
          </Card>
        </section>
      </main>

      {/* ⑩ Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-sm text-muted">
          <p>© {currentYear(locale)} {event.organizerName ?? name}</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-primary-dark">{dict.landing.privacyPolicy}</Link>
            <Link href="/terms" className="hover:text-primary-dark">{dict.landing.terms}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg sm:text-xl font-semibold text-ink mb-3">{children}</h2>;
}

function InfoTile({ icon, term, value }: { icon: string; term: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-[var(--radius-control)] p-3">
      <dt className="text-xs text-muted mb-0.5">
        <span aria-hidden="true">{icon}</span> {term}
      </dt>
      <dd className="text-sm text-ink font-medium">{value}</dd>
    </div>
  );
}
