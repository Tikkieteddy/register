"use client";

import Link from "next/link";
import { useState } from "react";
import { walkInAction } from "@/app/actions/walkin";
import { inputClass } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { SessionView } from "@/db/queries";
import { getDeviceId } from "@/lib/offline/db";
import { playFeedback, primeAudio } from "@/lib/offline/feedback";

/**
 * ลงทะเบียนหน้างาน (Walk-in) ตามข้อกำหนด B1
 * ฟอร์มย่อ ออกแบบให้กรอกเสร็จไม่เกิน 30 วินาที
 *
 * ⚠️ ต้องให้ผู้ร่วมงานอ่านและกดยินยอมเอง ไม่ใช่เจ้าหน้าที่ติ๊กแทน
 *    เพราะเป็นหลักฐานความยินยอมตามกฎหมาย PDPA
 */
export function WalkInScreen({
  eventSlug,
  sessions,
  occupations,
  online,
}: {
  eventSlug: string;
  sessions: SessionView[];
  occupations: string[];
  online: boolean;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    occupation: "",
  });
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [consentPdpa, setConsentPdpa] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    qrToken: string;
    registrationCode: string;
    name: string;
  } | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    primeAudio();
    setBanner(null);
    setBusy(true);
    try {
      const result = await walkInAction({
        eventSlug,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
        occupation: form.occupation || undefined,
        sessionIds,
        consentPhoto,
        consentPdpa,
        deviceId: getDeviceId(),
      });

      if (!result.ok) {
        setErrors(result.fieldErrors);
        if (result.message) setBanner(result.message);
        playFeedback("invalid");
        return;
      }

      playFeedback("success");
      setDone({
        qrToken: result.qrToken,
        registrationCode: result.registrationCode,
        name: `${result.firstName} ${result.lastName}`,
      });
    } catch {
      setBanner("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      playFeedback("invalid");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-lg p-4 flex flex-col gap-4">
        <div className="bg-success-bg border-2 border-[color:var(--color-success)] rounded-[var(--radius-card)] p-5 text-center flex flex-col gap-3">
          <div className="text-5xl" aria-hidden="true">✅</div>
          <p className="text-success font-semibold text-lg">ลงทะเบียนและเช็คอินแล้ว</p>
          <p className="text-2xl font-bold text-ink">{done.name}</p>
          <p className="font-mono text-ink">{done.registrationCode}</p>

          <button
            type="button"
            onClick={() =>
              window.open(
                `/staff/badge/${done.qrToken}?format=lanyard&autoprint=1`,
                "_blank",
                "noopener",
              )
            }
            className="min-h-[var(--control-height)] rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold"
          >
            🖨️ พิมพ์บัตรห้อยคอ
          </button>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setForm({ firstName: "", lastName: "", phone: "", email: "", occupation: "" });
              setSessionIds([]);
              setConsentPhoto(false);
              setConsentPdpa(false);
            }}
            className="min-h-11 rounded-[var(--radius-pill)] border border-line-strong text-ink-2 bg-surface font-medium"
          >
            ➕ ลงทะเบียนคนถัดไป
          </button>
          <Link href="/staff" className="text-primary-dark underline text-sm">
            กลับหน้าสแกน
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/staff" className="text-primary-dark font-medium">
          ← กลับ
        </Link>
        <h1 className="text-lg font-semibold text-ink">ลงทะเบียนหน้างาน</h1>
      </div>

      {!online && (
        <p className="bg-warning-bg text-warning rounded-[var(--radius-control)] px-4 py-3 text-sm">
          ⚠️ ขณะนี้ออฟไลน์ — การลงทะเบียนหน้างานต้องใช้อินเทอร์เน็ต
          กรุณารอสัญญาณกลับมาก่อน หรือจดข้อมูลไว้บนกระดาษก่อน
        </p>
      )}

      {banner && (
        <p
          role="alert"
          className="bg-[var(--color-danger-bg)] text-danger rounded-[var(--radius-control)] px-4 py-3 text-sm"
        >
          {banner}
        </p>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["firstName", "ชื่อ", true],
              ["lastName", "นามสกุล", true],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label htmlFor={key} className="text-sm text-ink-2 font-medium">
                {label}
                <span className="text-primary ms-1" aria-hidden="true">*</span>
              </label>
              <input
                id={key}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className={inputClass(Boolean(errors[key]))}
                autoComplete="off"
              />
              {errors[key] && (
                <p role="alert" className="text-danger text-sm">
                  {errors[key]}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm text-ink-2 font-medium">
            เบอร์โทรศัพท์
            <span className="text-primary ms-1" aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="08X XXX XXXX"
            className={inputClass(Boolean(errors.phone))}
          />
          {errors.phone && (
            <p role="alert" className="text-danger text-sm">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm text-ink-2 font-medium">
            อีเมล <span className="text-muted font-normal">(ไม่บังคับ — กรอกแล้วจะได้รับตั๋วทางอีเมล)</span>
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputClass(Boolean(errors.email))}
          />
          {errors.email && (
            <p role="alert" className="text-danger text-sm">
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="occupation" className="text-sm text-ink-2 font-medium">
            อาชีพ
            <span className="text-primary ms-1" aria-hidden="true">*</span>
          </label>
          <select
            id="occupation"
            value={form.occupation}
            onChange={(e) => set("occupation", e.target.value)}
            className={inputClass(false)}
          >
            <option value="">-----</option>
            {occupations.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-ink-2 font-medium mb-1">
            ช่วงเวลา
            <span className="text-primary ms-1" aria-hidden="true">*</span>
          </legend>
          {errors.sessionIds && (
            <p role="alert" className="text-danger text-sm">
              {errors.sessionIds}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {sessions.map((s) => {
              const checked = sessionIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 p-3 rounded-[var(--radius-control)] border cursor-pointer ${
                    checked ? "border-primary bg-primary-light" : "border-line-strong bg-surface"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSessionIds((ids) =>
                        checked ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                      )
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm">
                    {s.nameTh}
                    {s.isFull && <span className="block text-xs text-warning">เต็มแล้ว</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="bg-surface-2 rounded-[var(--radius-control)] p-3 flex flex-col gap-3">
          <p className="text-xs text-muted">
            ⚠️ ให้ผู้ร่วมงานอ่านและกดยืนยันด้วยตนเอง — เป็นหลักฐานความยินยอมตามกฎหมาย PDPA
          </p>
          {(
            [
              [
                "consentPhoto",
                consentPhoto,
                setConsentPhoto,
                "ยินยอมให้บันทึกภาพและนำไปใช้ประชาสัมพันธ์",
                errors.consentPhoto,
              ],
              [
                "consentPdpa",
                consentPdpa,
                setConsentPdpa,
                "ยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคลตาม PDPA",
                errors.consentPdpa,
              ],
            ] as const
          ).map(([id, value, setter, label, error]) => (
            <div key={id}>
              {error && (
                <p role="alert" className="text-danger text-sm mb-1">
                  {error}
                </p>
              )}
              <label className="flex items-start gap-2.5 cursor-pointer text-sm text-ink">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setter(e.target.checked)}
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                />
                <span>{label}</span>
              </label>
            </div>
          ))}
        </div>

        <Button type="submit" fullWidth loading={busy} disabled={!online}>
          บันทึกและเช็คอิน
        </Button>
      </form>
    </main>
  );
}
