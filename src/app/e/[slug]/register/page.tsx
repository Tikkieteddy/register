import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { trackFormViewAction } from "@/app/actions/registration";
import { RegistrationForm } from "@/components/form/RegistrationForm";
import { Card, CardBody } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { getEventBySlug, getFormQuestions } from "@/db/queries";
import { formatDateRange, formatTimeRange } from "@/lib/datetime";
import { getDictionary, isLocale, type Locale } from "@/i18n/dictionaries";

/** หน้าฟอร์มลงทะเบียน ตามข้อกำหนด D2 และ D3 */

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

export const metadata: Metadata = { title: "ลงทะเบียน" };

export default async function RegisterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { lang, ref, utm_source, utm_medium, utm_campaign } = await searchParams;
  const locale: Locale = lang && isLocale(lang) ? lang : "th";
  const dict = getDictionary(locale);

  const data = await getEventBySlug(slug);
  if (!data) notFound();

  const { event, sessions, registrationState } = data;

  // ปิดรับแล้วให้กลับไปหน้ารายละเอียดงาน ซึ่งอธิบายสถานะไว้ชัดเจนกว่า
  if (registrationState !== "open") {
    redirect(`/e/${slug}${locale === "en" ? "?lang=en" : ""}`);
  }

  const questions = await getFormQuestions(event.id);

  // บันทึกว่ามีคนเปิดหน้าฟอร์ม — ใช้ทำกราฟกรวยการแปลง (กราฟที่ 9)
  await trackFormViewAction(event.id, ref);

  const name = locale === "en" && event.nameEn ? event.nameEn : event.nameTh;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center">
          <Link href={`/e/${slug}`} className="font-[family-name:var(--font-display)] font-bold text-ink">
            {event.organizerName ?? name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 flex flex-col gap-6">
        <Stepper current={2} dict={dict} />

        {/* การ์ดสรุปข้อมูลงาน — อ่านอย่างเดียว */}
        <Card>
          <CardBody className="flex gap-4 items-start">
            <div
              className="size-20 sm:size-24 shrink-0 rounded-[var(--radius-control)] bg-gradient-to-br from-primary to-primary-dark"
              aria-hidden="true"
            />
            <div className="min-w-0 flex flex-col gap-1">
              <h1 className="text-base sm:text-lg font-semibold text-ink">{name}</h1>
              <p className="text-sm text-ink-2">
                <span aria-hidden="true">📅</span> {formatDateRange(event.startsAt, event.endsAt, locale)}
              </p>
              <p className="text-sm text-ink-2">
                <span aria-hidden="true">🕐</span> {formatTimeRange(event.startsAt, event.endsAt, locale)}
              </p>
              <p className="text-sm text-ink-2 truncate">
                <span aria-hidden="true">📍</span> {event.venueName ?? "-"}
              </p>
              {event.category && (
                <span className="self-start mt-1 px-2.5 py-0.5 rounded-[var(--radius-pill)] bg-primary-light text-primary-dark text-xs">
                  {event.category}
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        <RegistrationForm
          eventSlug={slug}
          sessions={sessions}
          questions={questions}
          dict={dict}
          locale={locale}
          privacyHref="/privacy"
          shareLinkCode={ref ?? ""}
          utm={{ source: utm_source, medium: utm_medium, campaign: utm_campaign }}
        />
      </main>
    </div>
  );
}
