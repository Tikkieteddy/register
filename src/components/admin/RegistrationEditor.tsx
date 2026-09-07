"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  anonymizeRegistrationAction,
  cancelRegistrationsAction,
  resendEmailsAction,
  updateRegistrationAction,
} from "@/app/actions/admin/registrations";

const FIELD =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

/**
 * ฟอร์มแก้ไขข้อมูลผู้ลงทะเบียน (หัวข้อ 3.3)
 *
 * ⚠️ การแก้ช่วงเวลาไปกระทบตัวนับที่นั่งโดยตรง จึงต้องให้ผู้ใช้เห็นชัดว่า
 *    กำลังเปลี่ยนช่วงไหน และทุกการแก้ถูกบันทึกลง audit log ว่าก่อน-หลังเป็นอะไร
 */
export function RegistrationEditor({
  id,
  initial,
  sessions,
  isCancelled,
}: {
  id: string;
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    occupation: string;
    sessionIds: string[];
  };
  sessions: { id: string; nameTh: string }[];
  isCancelled: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSession(sessionId: string) {
    setForm((prev) => ({
      ...prev,
      sessionIds: prev.sessionIds.includes(sessionId)
        ? prev.sessionIds.filter((s) => s !== sessionId)
        : [...prev.sessionIds, sessionId],
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateRegistrationAction({ id, ...form });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function resend() {
    startTransition(async () => {
      const result = await resendEmailsAction([id]);
      setNotice({ ok: result.ok, text: result.message });
      router.refresh();
    });
  }

  function cancel() {
    const reason = window.prompt(
      "ยกเลิกการลงทะเบียนนี้ และคืนที่นั่งเข้าระบบ\nQR เดิมจะใช้ไม่ได้อีก\n\nระบุเหตุผล:",
      "ผู้ลงทะเบียนแจ้งยกเลิก",
    );
    if (reason === null) return;
    startTransition(async () => {
      const result = await cancelRegistrationsAction([id], reason);
      setNotice({ ok: result.ok, text: result.message });
      router.refresh();
    });
  }

  function anonymize() {
    const confirmed = window.confirm(
      "ลบข้อมูลส่วนบุคคลตามคำขอ PDPA\n\n" +
        "ชื่อ อีเมล และเบอร์โทรจะถูกแทนที่ด้วยค่าที่ระบุตัวบุคคลไม่ได้\n" +
        "สถิติในรายงานจะยังคงเดิม\n\n" +
        "การกระทำนี้ย้อนกลับไม่ได้ — ยืนยันหรือไม่",
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await anonymizeRegistrationAction(id);
      setNotice({ ok: result.ok, text: result.message });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
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

      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ["firstName", "ชื่อ"],
            ["lastName", "นามสกุล"],
            ["email", "อีเมล"],
            ["phone", "โทรศัพท์มือถือ"],
            ["occupation", "อาชีพ"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{label}</span>
            <input
              className={FIELD}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              aria-invalid={errors[key] ? true : undefined}
            />
            {errors[key] ? (
              <span className="text-xs text-danger">{errors[key]}</span>
            ) : null}
          </label>
        ))}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-muted mb-1">
          ช่วงเวลา — การเปลี่ยนตรงนี้จะคืนและตัดที่นั่งให้อัตโนมัติ
        </legend>
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
                  onChange={() => toggleSession(s.id)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-ink">{s.nameTh}</span>
              </label>
            );
          })}
        </div>
        {errors.sessionIds ? (
          <span className="text-xs text-danger">{errors.sessionIds}</span>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          บันทึกการแก้ไข
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-primary text-primary-dark text-sm font-semibold hover:bg-primary-light disabled:opacity-50"
        >
          ส่งอีเมลซ้ำ
        </button>
        {!isCancelled ? (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-danger-border text-danger text-sm font-semibold hover:bg-danger-bg disabled:opacity-50"
          >
            ยกเลิกการลงทะเบียน
          </button>
        ) : null}
        <button
          type="button"
          onClick={anonymize}
          disabled={pending}
          className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-line text-muted text-sm hover:bg-surface-2 disabled:opacity-50 ml-auto"
        >
          ลบข้อมูลส่วนบุคคล (PDPA)
        </button>
      </div>
    </form>
  );
}
