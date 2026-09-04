import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResendEmailButton, TicketActions } from "@/components/ticket/TicketActions";
import { TicketCard } from "@/components/ticket/TicketCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { getDictionary } from "@/i18n/dictionaries";
import { googleCalendarUrl } from "@/lib/calendar";
import { calendarEventFromTicket } from "@/lib/email/confirmation";
import { clientEnv } from "@/lib/env";
import { qrDataUrl } from "@/lib/qr";
import { getTicketByToken } from "@/lib/ticket";

/**
 * หน้า "เสร็จสิ้น" และหน้าบัตรเข้างานออนไลน์ — เป็นหน้าเดียวกัน
 * ตามข้อกำหนด D4 และภาพอ้างอิงที่ 6
 *
 * ?justRegistered=1 คือเข้ามาจากการกดลงทะเบียนเสร็จ จะแสดงข้อความขอบคุณ
 * ส่วนการเข้าจากลิงก์ในอีเมลจะแสดงเป็นบัตรเข้างานอย่างเดียว
 */
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ justRegistered?: string }>;
};

export const metadata: Metadata = { title: "บัตรเข้างาน" };

export default async function TicketPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { justRegistered } = await searchParams;

  const ticket = await getTicketByToken(token);
  if (!ticket) notFound();

  const dict = getDictionary("th");
  const qrDataUri = await qrDataUrl(ticket.qrToken, 400);
  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const isNew = justRegistered === "1";

  const cancelled = ticket.status === "cancelled";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-14 flex items-center">
          <Link
            href={`/e/${ticket.event.slug}`}
            className="font-[family-name:var(--font-display)] font-bold text-ink"
          >
            {ticket.event.organizerName ?? ticket.event.nameTh}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 flex flex-col gap-6">
        {isNew && <Stepper current={3} dict={dict} />}

        {cancelled && (
          <div
            role="alert"
            className="bg-[var(--color-danger-bg)] border border-[color:var(--color-danger-border)] rounded-[var(--radius-control)] px-4 py-3"
          >
            <p className="font-semibold text-danger">การลงทะเบียนนี้ถูกยกเลิกแล้ว</p>
            <p className="text-sm text-ink-2 mt-1">
              บัตรใบนี้ใช้เข้างานไม่ได้ หากต้องการเข้าร่วมงาน กรุณาลงทะเบียนใหม่อีกครั้ง
            </p>
          </div>
        )}

        <Card>
          <CardBody className="flex flex-col gap-5">
            {isNew && (
              <div className="text-center flex flex-col items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-ink">
                  ขอบคุณสำหรับการลงทะเบียน {ticket.firstName}
                </h1>
                <p className="text-sm text-ink-2">คุณได้ทำการลงทะเบียนเสร็จเรียบร้อยแล้ว</p>
                <hr className="w-16 border-t-2 border-primary my-1" />
                <p className="text-sm text-ink-2">
                  คุณสามารถเลือกใช้ตั๋วอิเล็กทรอนิกส์/พิมพ์ตั๋วกระดาษเพื่อเข้างาน
                </p>
              </div>
            )}

            {!isNew && (
              <h1 className="text-lg font-semibold text-ink">
                บัตรเข้างาน — {ticket.event.nameTh}
              </h1>
            )}

            <h2 className="text-base font-semibold text-primary-dark">
              {ticket.ticketType} - {ticket.event.nameTh}
            </h2>

            <TicketCard ticket={ticket} qrDataUri={qrDataUri} />

            {!cancelled && (
              <TicketActions
                printUrl={`/ticket/${ticket.qrToken}/print`}
                icsUrl={`/ticket/${ticket.qrToken}/calendar.ics`}
                googleCalendarUrl={googleCalendarUrl(calendarEventFromTicket(ticket))}
              />
            )}
          </CardBody>
        </Card>

        {isNew && (
          <div className="bg-primary-light border border-[color:var(--color-primary)] rounded-[var(--radius-card)] px-4 py-3.5 text-sm text-ink-2">
            <p>
              <span aria-hidden="true">✉️</span> ระบบได้ส่งอีเมลยืนยันไปที่{" "}
              <strong className="text-ink">{ticket.email}</strong> แล้ว
            </p>
            <p className="mt-1">
              หากไม่พบอีเมลภายใน 5 นาที กรุณาตรวจสอบในกล่อง Junk/Spam หรือ{" "}
              <ResendEmailButton qrToken={ticket.qrToken} />
            </p>
          </div>
        )}

        <p className="text-sm text-muted text-center">
          บันทึกหน้านี้ไว้เพื่อเปิดดู QR ได้ตลอดเวลา —{" "}
          <span className="text-ink-2">{site}/ticket/{ticket.qrToken}</span>
        </p>
      </main>
    </div>
  );
}
