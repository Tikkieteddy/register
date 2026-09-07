"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRegistrationAction } from "@/app/actions/admin/registrations";

const FIELD =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

/**
 * เพิ่มผู้ลงทะเบียนด้วยมือ — สำหรับแขก VIP หรือคนที่โทรมาลงทะเบียน (หัวข้อ 3.3)
 *
 * ⚠️ ผู้ดูแลต้องอ่านข้อความ PDPA ให้ผู้ลงทะเบียนฟังทางโทรศัพท์ก่อนกดบันทึก
 *    เพราะระบบจะบันทึกความยินยอมแทนเขา
 */
export function NewRegistrationForm({
  eventId,
  sessions,
}: {
  eventId: string;
  sessions: { id: string; nameTh: string; remaining: number }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    occupation: "",
    sessionIds: [] as string[],
    sendEmail: true,
  });
  const [confirmedConsent, setConfirmedConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmedConsent) {
      setNotice({ ok: false, text: "ต้องยืนยันว่าได้แจ้งข้อความ PDPA ให้ผู้ลงทะเบียนทราบแล้ว" });
      return;
    }
    startTransition(async () => {
      const result = await createRegistrationAction({ eventId, ...form });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok && result.registrationId) {
        router.push(`/admin/registrations/${result.registrationId}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-2xl">
      {notice ? (
        <p
          role="alert"
          className={`text-sm rounded-[var(--radius-control)] px-3 py-2 ${
            notice.ok
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : "bg-danger-bg text-danger"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ["firstName", "ชื่อ"],
            ["lastName", "นามสกุล"],
            ["email", "อีเมล"],
            ["phone", "โทรศัพท์มือถือ"],
            ["occupation", "อาชีพ (ไม่บังคับ)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{label}</span>
            <input
              className={FIELD}
              value={form[key]}
              inputMode={key === "phone" ? "tel" : undefined}
              type={key === "email" ? "email" : "text"}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              aria-invalid={errors[key] ? true : undefined}
            />
            {errors[key] ? <span className="text-xs text-danger">{errors[key]}</span> : null}
          </label>
        ))}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted mb-1">ช่วงเวลา</legend>
        <div className="flex flex-wrap gap-2">
          {sessions.map((s) => {
            const checked = form.sessionIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex items-center gap-2 min-h-11 px-3 rounded-[var(--radius-control)] border cursor-pointer ${
                  checked ? "border-primary bg-primary-light" : "border-line bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      sessionIds: checked
                        ? prev.sessionIds.filter((id) => id !== s.id)
                        : [...prev.sessionIds, s.id],
                    }))
                  }
                  className="size-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-ink">{s.nameTh}</span>
                <span
                  className={`text-xs tabular-nums ${s.remaining <= 0 ? "text-danger" : "text-muted"}`}
                >
                  {s.remaining <= 0 ? "เต็มแล้ว" : `เหลือ ${s.remaining}`}
                </span>
              </label>
            );
          })}
        </div>
        {errors.sessionIds ? (
          <span className="text-xs text-danger">{errors.sessionIds}</span>
        ) : null}
        <p className="text-xs text-muted">
          การเพิ่มด้วยมือลงที่นั่งได้แม้เต็มแล้ว เพราะเป็นการตัดสินใจของผู้ดูแลเป็นรายกรณี
        </p>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.sendEmail}
          onChange={(e) => setForm((prev) => ({ ...prev, sendEmail: e.target.checked }))}
          className="size-4 mt-1 accent-[var(--color-primary)]"
        />
        <span className="text-ink-2">ส่งอีเมลยืนยันพร้อม QR ให้ทันทีหลังบันทึก</span>
      </label>

      <label className="flex items-start gap-2 text-sm bg-primary-light rounded-[var(--radius-control)] p-3">
        <input
          type="checkbox"
          checked={confirmedConsent}
          onChange={(e) => setConfirmedConsent(e.target.checked)}
          className="size-4 mt-1 accent-[var(--color-primary)]"
        />
        <span className="text-ink-2">
          ยืนยันว่าได้แจ้งข้อความความยินยอมตาม PDPA ให้ผู้ลงทะเบียนทราบ และได้รับความยินยอมแล้ว
          <span className="block text-xs text-muted mt-0.5">
            ระบบจะบันทึกความยินยอมนี้พร้อมเวลาและเวอร์ชันนโยบายเป็นหลักฐาน
          </span>
        </span>
      </label>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 px-6 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          บันทึกและออกตั๋ว
        </button>
      </div>
    </form>
  );
}
