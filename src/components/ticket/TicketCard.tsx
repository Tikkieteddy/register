import Image from "next/image";
import { formatDateRange, formatTimeRange } from "@/lib/datetime";
import type { TicketView } from "@/lib/ticket";

/**
 * การ์ดตั๋วอิเล็กทรอนิกส์ ตามข้อกำหนด D4 และภาพอ้างอิงที่ 6
 *
 * รายละเอียดที่ถอดจากภาพ:
 *   - หัวการ์ดเป็นรูปแบบ "[ประเภทตั๋ว] - [ชื่องาน]"
 *   - กรอบข้อมูลตั๋วด้านในใช้เส้นประ
 *   - ข้อมูลจัดเป็นคู่ 2 คอลัมน์: เจ้าของตั๋ว|อีเมล · ประเภทตั๋ว|การชำระเงิน · วันที่|เวลา
 *   - label ตัวเล็กสีเทา / value ตัวหนาสีดำ
 *   - ที่อยู่แสดงเต็มหลายบรรทัด
 */
function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted mb-0.5">{label}</dt>
      <dd className="text-sm text-ink font-semibold break-words">{children}</dd>
    </div>
  );
}

export function TicketCard({
  ticket,
  qrDataUri,
}: {
  ticket: TicketView;
  qrDataUri: string;
}) {
  const timeLines =
    ticket.sessions.length > 0
      ? ticket.sessions.map((s) => `${s.nameTh} ${formatTimeRange(s.startsAt, s.endsAt)}`)
      : [formatTimeRange(ticket.event.startsAt, ticket.event.endsAt)];

  return (
    <div className="border border-dashed border-line-strong rounded-[var(--radius-control)] p-4 sm:p-5">
      <div className="grid sm:grid-cols-[10rem_1fr] gap-5">
        {/* คอลัมน์ซ้าย: โปสเตอร์ → QR → โค้ดใต้ QR → ประเภทตั๋ว → เจ้าของตั๋ว */}
        <div className="flex flex-col items-center sm:items-start gap-3">
          <div
            className="w-full max-w-40 aspect-square rounded-[var(--radius-control)] bg-gradient-to-br from-primary to-primary-dark"
            aria-hidden="true"
          />
          <Image
            src={qrDataUri}
            alt={`QR Code สำหรับเช็คอิน รหัส ${ticket.ticketCode}`}
            width={160}
            height={160}
            unoptimized
            className="w-40 h-40 border border-line rounded-[var(--radius-control)] bg-white"
          />
          <p className="font-mono text-xs text-ink tracking-wider text-center sm:text-left">
            {ticket.ticketCode}
          </p>
          <div className="w-full">
            <p className="text-xs text-muted">{ticket.ticketType}</p>
            <p className="text-sm font-semibold text-ink">
              {ticket.firstName} {ticket.lastName}
            </p>
          </div>
        </div>

        {/* คอลัมน์ขวา: ชื่องาน → รหัสคำสั่งซื้อ → ข้อมูลตั๋วเป็นคู่ */}
        <div className="min-w-0 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">{ticket.event.nameTh}</h3>
            <p className="text-sm text-muted mt-1">
              รหัสคำสั่งซื้อ:{" "}
              <span className="font-mono font-bold text-primary-dark tracking-wider">
                {ticket.registrationCode}
              </span>
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <Pair label="เจ้าของตั๋ว">
              {ticket.firstName} {ticket.lastName}
            </Pair>
            <Pair label="อีเมล">{ticket.email}</Pair>
            <Pair label="ประเภทตั๋ว">{ticket.ticketType}</Pair>
            <Pair label="การชำระเงิน">FREE</Pair>
            <Pair label="วันที่">
              {formatDateRange(ticket.event.startsAt, ticket.event.endsAt)}
            </Pair>
            <Pair label="เวลา">
              {timeLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </Pair>
          </dl>

          <dl>
            <Pair label="สถานที่จัดงาน">
              <span className="block font-semibold">{ticket.event.venueName ?? "-"}</span>
              <span className="block font-normal text-ink-2 whitespace-pre-line">
                {ticket.event.venueAddress ?? ""}
              </span>
              <span className="block font-normal text-ink-2">ไทย</span>
            </Pair>
          </dl>
        </div>
      </div>
    </div>
  );
}
