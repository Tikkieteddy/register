"use client";

import { useEffect } from "react";

/**
 * ปุ่มบนหน้าเสร็จสิ้นและหน้าบัตรออนไลน์
 *
 * ตามภาพอ้างอิงที่ 6: "พิมพ์ตั๋ว" (ทึบ) และ "ดาวน์โหลดตั๋ว" (ขอบ) อยู่คู่กัน
 * ส่วน "ดาวน์โหลดปฏิทิน" อยู่แถวล่างแยก พื้นสีอ่อน — ทุกปุ่มทรงแคปซูล
 */
export function TicketActions({
  printUrl,
  icsUrl,
  googleCalendarUrl,
}: {
  printUrl: string;
  icsUrl: string;
  googleCalendarUrl: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={printUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 min-h-[var(--control-height)] px-6 rounded-[var(--radius-pill)]
            bg-primary text-primary-contrast font-semibold hover:bg-primary-dark transition-colors"
        >
          <span aria-hidden="true">🖨️</span> พิมพ์ตั๋ว
        </a>
        {/*
          บันทึกเป็น PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์ (เลือกปลายทางเป็น "Save as PDF")
          เลือกวิธีนี้เพราะการสร้าง PDF ฝั่งเซิร์ฟเวอร์ยังวางสระและวรรณยุกต์ไทยผิดตำแหน่ง
          ส่วนหน้าต่างพิมพ์ของเบราว์เซอร์เรนเดอร์ภาษาไทยได้ถูกต้อง 100%
        */}
        <a
          href={`${printUrl}?autoprint=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 min-h-[var(--control-height)] px-6 rounded-[var(--radius-pill)]
            bg-surface text-primary-dark border border-primary font-semibold hover:bg-primary-light transition-colors"
        >
          <span aria-hidden="true">⬇️</span> บันทึกตั๋วเป็น PDF
        </a>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={googleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-[var(--radius-pill)]
            bg-primary-light text-primary-dark text-sm hover:bg-[#ffe4d5] transition-colors"
        >
          <span aria-hidden="true">📅</span> เพิ่มลง Google Calendar
        </a>
        <a
          href={icsUrl}
          download
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-[var(--radius-pill)]
            bg-primary-light text-primary-dark text-sm hover:bg-[#ffe4d5] transition-colors"
        >
          <span aria-hidden="true">📥</span> ดาวน์โหลดปฏิทิน (.ics)
        </a>
      </div>
      <p className="text-xs text-muted text-center max-w-md">
        Google Calendar ใช้ปุ่มซ้าย · Apple Calendar และ Outlook ใช้ไฟล์ .ics
      </p>
    </div>
  );
}

/**
 * ปุ่มพิมพ์บนหน้าตั๋วสำหรับพิมพ์ — ซ่อนตัวเองตอนสั่งพิมพ์จริง
 *
 * ถ้ามาพร้อม ?autoprint=1 จะเปิดหน้าต่างพิมพ์ให้อัตโนมัติ
 * เพื่อให้ผู้ใช้เลือกปลายทางเป็น "Save as PDF" ได้ในคลิกเดียว
 */
export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    // รอให้ฟอนต์และ QR เรนเดอร์เสร็จก่อน ไม่งั้นตั๋วจะออกมาไม่ครบ
    const id = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(id);
  }, [autoPrint]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 min-h-[var(--control-height)] px-6
        rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold hover:bg-primary-dark transition-colors"
    >
      <span aria-hidden="true">🖨️</span> สั่งพิมพ์ / บันทึกเป็น PDF
    </button>
  );
}

/** ปุ่มส่งอีเมลซ้ำ — จำกัด 3 ครั้งต่อชั่วโมงที่ฝั่งเซิร์ฟเวอร์ */
export function ResendEmailButton({ qrToken }: { qrToken: string }) {
  return (
    <button
      type="button"
      onClick={async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        button.textContent = "กำลังส่ง...";
        try {
          const res = await fetch(`/api/resend-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrToken }),
          });
          const body = (await res.json()) as { ok: boolean; message?: string };
          button.textContent = body.ok ? "✓ ส่งอีเมลแล้ว" : (body.message ?? "ส่งไม่สำเร็จ");
        } catch {
          button.textContent = "ส่งไม่สำเร็จ กรุณาลองใหม่";
          button.disabled = false;
        }
      }}
      className="text-primary-dark underline font-semibold disabled:text-muted disabled:no-underline"
    >
      ส่งอีเมลซ้ำ
    </button>
  );
}
