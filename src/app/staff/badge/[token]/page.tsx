import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/ticket/TicketActions";
import { canScan, getSession } from "@/lib/auth/session";
import { getTicketByToken } from "@/lib/ticket";

/**
 * บัตรห้อยคอ / ริสแบนด์ สำหรับพิมพ์หน้างาน ตามข้อกำหนด B2
 *
 * เลย์เอาต์ถอดจากบัตรตัวอย่างจริงในภาพแผนผัง (SET Thailand Focus 2026)
 * แนวตั้ง 4 ส่วนจากบนลงล่าง:
 *   ① โลโก้ผู้จัด ② บล็อกชื่องาน ③ ชื่อผู้เข้าร่วม (ส่วนเดียวที่เปลี่ยนตามคน) ④ แถบผู้สนับสนุน
 *
 * ⚠️ ต้องทดสอบพิมพ์กับเครื่องพิมพ์ตัวจริงก่อนวันงานอย่างน้อย 1 วัน
 *    ขนาดกระดาษและ margin ของแต่ละรุ่นต่างกันมาก
 */
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ format?: string; autoprint?: string }>;
};

export const metadata: Metadata = { title: "พิมพ์บัตร" };

export default async function BadgePage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!canScan(session)) redirect("/staff/login?next=/staff");

  const { token } = await params;
  const { format, autoprint } = await searchParams;
  const ticket = await getTicketByToken(token);
  if (!ticket) notFound();

  const isWristband = format === "wristband";
  const fullName = `${ticket.firstName} ${ticket.lastName}`;
  const sessionText = ticket.sessions.map((s) => s.nameTh).join(" · ");

  return (
    <div className="bg-white text-black min-h-screen">
      <style>{`
        /* บัตรห้อยคอ 10x14 ซม. · ริสแบนด์ 25x2.5 ซม. ตามข้อกำหนด B2 */
        @page { size: ${isWristband ? "250mm 25mm" : "100mm 140mm"}; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .badge { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print bg-neutral-100 border-b border-neutral-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-700">
          <p>
            รูปแบบ: <strong>{isWristband ? "ริสแบนด์ 25×2.5 ซม." : "บัตรห้อยคอ 10×14 ซม."}</strong>
          </p>
          <p className="text-xs mt-0.5">
            ตั้งค่าเครื่องพิมพ์: Margins = None · Scale = 100% · Background graphics = เปิด
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/staff/badge/${token}?format=${isWristband ? "lanyard" : "wristband"}`}
            className="min-h-11 px-4 inline-flex items-center rounded-[var(--radius-pill)] border border-neutral-400 text-sm"
          >
            สลับเป็น{isWristband ? "บัตรห้อยคอ" : "ริสแบนด์"}
          </a>
          <PrintButton autoPrint={autoprint === "1"} />
        </div>
      </div>

      <div className="p-6 flex justify-center">
        {isWristband ? (
          /* ---------- ริสแบนด์ แนวยาว ---------- */
          <div className="badge w-[250mm] max-w-full h-[25mm] border border-neutral-300 flex items-center px-6 gap-6">
            <span className="text-[10px] font-bold uppercase tracking-widest shrink-0">
              {ticket.event.organizerName ?? "EVENT"}
            </span>
            <span className="text-[15pt] font-bold truncate flex-1">{fullName}</span>
            <span className="font-mono text-[10pt] shrink-0">{ticket.registrationCode}</span>
            {sessionText && <span className="text-[9pt] shrink-0">{sessionText}</span>}
          </div>
        ) : (
          /* ---------- บัตรห้อยคอ แนวตั้ง ---------- */
          <div className="badge w-[100mm] h-[140mm] border border-neutral-300 flex flex-col">
            {/* ① โลโก้ผู้จัด */}
            <div className="px-5 pt-5">
              <div className="inline-block bg-black text-white text-[8pt] px-3 py-1.5 rounded-sm">
                {ticket.event.organizerName ?? "LOGO"}
              </div>
            </div>

            {/* ② บล็อกชื่องาน */}
            <div className="px-5 pt-4">
              <p className="text-[15pt] font-bold leading-tight">{ticket.event.nameTh}</p>
            </div>

            {/* ③ ส่วนที่เปลี่ยนตามคน — ชื่อต้องอ่านได้จากระยะ 2-3 เมตร */}
            <div className="flex-1 flex flex-col justify-center px-5">
              <p className="text-[26pt] font-bold leading-tight break-words">{fullName}</p>
              <p className="font-mono text-[11pt] mt-2">{ticket.registrationCode}</p>
              {sessionText && <p className="text-[10pt] text-neutral-600 mt-0.5">{sessionText}</p>}
            </div>

            {/* ④ แถบผู้สนับสนุน */}
            <div className="h-[18mm] bg-neutral-200 flex items-center justify-center text-[8pt] text-neutral-600">
              แถบโลโก้ผู้สนับสนุน — รอไฟล์กราฟิกจากผู้จัด (คำถาม Q8)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
