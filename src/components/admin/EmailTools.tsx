"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resendAllFailedAction, sendTestEmailAction } from "@/app/actions/admin/emails";

/**
 * เครื่องมือของหน้าจัดการอีเมล (หัวข้อ 3.6)
 *
 * ปุ่ม "ส่งอีเมลทดสอบ" ถูกวางไว้ให้เด่นที่สุด เพราะเป็นขั้นตอนที่ต้องทำ
 * ก่อนเปิดรับลงทะเบียนจริงเสมอ แต่เป็นขั้นตอนที่คนลืมบ่อยที่สุด
 */
export function EmailTools({
  eventId,
  defaultEmail,
  failedCount,
  emailConfigured,
}: {
  eventId: string;
  defaultEmail: string;
  failedCount: number;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState(defaultEmail);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {!emailConfigured ? (
        <p className="text-sm bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-[var(--radius-control)] px-3 py-2">
          ⚠️ ยังไม่ได้ตั้งค่าบริการส่งอีเมล — ตอนนี้ระบบเขียนอีเมลลงหน้าจอเซิร์ฟเวอร์แทนการส่งจริง
          ต้องใส่ <code>RESEND_API_KEY</code> และ <code>EMAIL_FROM</code> ก่อนเปิดใช้งานจริง
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className={`text-sm rounded-[var(--radius-control)] px-3 py-2 ${
            notice.ok
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : "bg-danger-bg text-danger"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        <section className="border border-line rounded-[var(--radius-card)] p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink">ส่งอีเมลทดสอบหาตัวเอง</h2>
          <p className="text-xs text-muted">
            ต้องทำก่อนเปิดรับลงทะเบียนจริงเสมอ แล้วตรวจว่าอีเมลไม่ตกถัง Junk
            ถ้าตก แปลว่า SPF / DKIM / DMARC ยังตั้งไม่ครบ
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await sendTestEmailAction(testEmail);
                  setNotice({ ok: result.ok, text: result.message });
                })
              }
              className="min-h-11 px-4 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 whitespace-nowrap"
            >
              ส่งทดสอบ
            </button>
          </div>
        </section>

        <section className="border border-line rounded-[var(--radius-card)] p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink">ส่งซ้ำทั้งหมดที่ล้มเหลว</h2>
          <p className="text-xs text-muted">
            ขณะนี้มี <strong className="text-ink tabular-nums">{failedCount}</strong> ฉบับ
            ที่ส่งไม่สำเร็จหรือตีกลับ · กดครั้งเดียวส่งใหม่ให้ทุกคนที่ค้างอยู่ (ครั้งละไม่เกิน 100 ฉบับ)
          </p>
          <button
            type="button"
            disabled={pending || failedCount === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await resendAllFailedAction(eventId);
                setNotice({ ok: result.ok, text: result.message });
                router.refresh();
              })
            }
            className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-primary text-primary-dark text-sm font-semibold hover:bg-primary-light disabled:opacity-40 self-start"
          >
            ส่งซ้ำทั้งหมดที่ล้มเหลว
          </button>
        </section>
      </div>
    </div>
  );
}
