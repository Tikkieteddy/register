import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ticket/TicketActions";
import { formatDateRange, formatTimeRange } from "@/lib/datetime";
import { qrSvg } from "@/lib/qr";
import { getTicketByToken } from "@/lib/ticket";

/**
 * ตั๋วสำหรับพิมพ์ ตามข้อกำหนด D5 และภาพอ้างอิงที่ 7
 *
 * เลย์เอาต์ 2 คอลัมน์ ซ้ายแคบ ~25% ขวากว้าง ~75%
 * ⚠️ ขาว-ดำ-เทาล้วน ไม่มีสี — ออกแบบมาเพื่อพิมพ์เครื่องขาว-ดำโดยเฉพาะ
 *    ใช้ QR แบบ SVG เพื่อให้คมชัดทุกความละเอียดของเครื่องพิมพ์
 */
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ autoprint?: string }>;
};

export const metadata: Metadata = { title: "ตั๋วเข้างาน" };

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-neutral-500 mb-0.5">{label}</dt>
      <dd className="text-[13px] text-black break-words">{children}</dd>
    </div>
  );
}

export default async function PrintTicketPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { autoprint } = await searchParams;
  const ticket = await getTicketByToken(token);
  if (!ticket) notFound();

  const svg = await qrSvg(ticket.qrToken);
  const timeLines =
    ticket.sessions.length > 0
      ? ticket.sessions.map((s) => `${s.nameTh} ${formatTimeRange(s.startsAt, s.endsAt)}`)
      : [formatTimeRange(ticket.event.startsAt, ticket.event.endsAt)];

  return (
    <div className="bg-white text-black min-h-screen">
      {/*
        @media print — ตั้งให้พอดี A4 แนวนอน 1 ใบต่อ 1 หน้า ไม่ตัดขอบ
        และซ่อนทุกอย่างที่ไม่ใช่ตัวตั๋ว
      */}
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .ticket-sheet { border: 1px solid #999 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print bg-neutral-100 border-b border-neutral-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-700">
          ตั้งค่าเครื่องพิมพ์เป็น <strong>A4 แนวนอน · Margins: None · Scale 100%</strong> เพื่อให้ได้ขนาดตรงตามแบบ
          <br />
          ต้องการไฟล์ PDF ให้เลือกปลายทางเป็น <strong>&quot;Save as PDF&quot;</strong> ในหน้าต่างพิมพ์
        </p>
        <PrintButton autoPrint={autoprint === "1"} />
      </div>

      <div className="p-6 flex justify-center">
        <div className="ticket-sheet w-full max-w-[260mm] border border-neutral-400 rounded grid grid-cols-1 sm:grid-cols-[25%_75%]">
          {/* ---------- คอลัมน์ซ้าย ---------- */}
          <div className="p-6 flex flex-col items-center gap-3 border-b sm:border-b-0 sm:border-r border-dashed border-neutral-400">
            <div className="w-24 h-14 bg-black text-white text-[10px] flex items-center justify-center rounded-sm">
              {ticket.event.organizerName ?? "LOGO"}
            </div>

            {/* QR แบบ SVG คมชัดทุกความละเอียดของเครื่องพิมพ์ */}
            <div
              className="w-40 h-40 [&>svg]:w-full [&>svg]:h-full"
              role="img"
              aria-label={`QR Code สำหรับเช็คอิน รหัส ${ticket.ticketCode}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            <p className="font-mono text-[13px] font-bold tracking-wider text-center">
              {ticket.ticketCode}
            </p>
            <p className="text-[13px] font-bold text-center leading-snug">{ticket.event.nameTh}</p>

            <hr className="w-full border-t border-dashed border-neutral-400 my-1" />

            <div className="w-full">
              <p className="text-[11px] text-neutral-500">{ticket.ticketType}</p>
              <p className="text-[13px]">
                {ticket.firstName} {ticket.lastName}
              </p>
            </div>
          </div>

          {/* ---------- คอลัมน์ขวา ---------- */}
          <div className="p-6 flex flex-col gap-3">
            <p className="text-[13px]">
              รหัสคำสั่งซื้อ:{" "}
              <span className="font-mono font-bold tracking-wider">{ticket.registrationCode}</span>
            </p>

            <hr className="border-t border-neutral-300" />

            <dl className="flex flex-col gap-3">
              <Pair label="อีเว้นท์">{ticket.event.nameTh}</Pair>

              <div className="grid grid-cols-2 gap-x-6">
                <Pair label="เจ้าของตั๋ว">
                  {ticket.firstName} {ticket.lastName}
                </Pair>
                <Pair label="อีเมล">{ticket.email}</Pair>
              </div>

              <Pair label="ประเภทตั๋ว">{ticket.ticketType}</Pair>
              <Pair label="การชำระเงิน">FREE</Pair>
            </dl>

            <hr className="border-t border-neutral-300" />

            <dl className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-6">
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
              </div>

              <Pair label="สถานที่จัดงาน">
                <span className="block">{ticket.event.venueName ?? "-"}</span>
                <span className="block whitespace-pre-line">{ticket.event.venueAddress ?? ""}</span>
                <span className="block">ไทย</span>
              </Pair>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
