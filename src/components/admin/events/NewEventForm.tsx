"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createEventAction } from "@/app/actions/admin/event";
import { suggestSlug } from "@/lib/slug";

/**
 * ฟอร์มสร้างงานใหม่
 *
 * ตั้งใจให้กรอกน้อยที่สุดเท่าที่ระบบต้องใช้จริง (ชื่อ · ลิงก์ · วันเวลา · ที่นั่ง)
 * ส่วนรายละเอียดอื่นอย่างคำอธิบาย แผนที่ ผู้จัด ไปกรอกต่อที่หน้า "ตั้งค่างาน"
 * เพราะถ้ารวมทุกช่องไว้ที่นี่ ฟอร์มจะยาวจนคนกรอกไม่จบและไม่ได้สร้างงานสักที
 */

const FIELD =
  "w-full min-h-[var(--control-height)] px-3 rounded-[var(--radius-control)] border border-line-strong " +
  "bg-surface text-ink focus:border-primary focus:outline-none";

export function NewEventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  // จำว่าผู้ใช้แก้ช่องลิงก์เองหรือยัง ถ้าแก้แล้วต้องหยุดเดาทับ ไม่งั้นค่าที่พิมพ์จะหายไปเอง
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState("");
  const [venueName, setVenueName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [morningStart, setMorningStart] = useState("09:00");
  const [morningEnd, setMorningEnd] = useState("12:00");
  const [morningQuota, setMorningQuota] = useState("250");
  const [afternoonStart, setAfternoonStart] = useState("13:00");
  const [afternoonEnd, setAfternoonEnd] = useState("16:00");
  const [afternoonQuota, setAfternoonQuota] = useState("250");

  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateName(value: string, field: "th" | "en") {
    const nextTh = field === "th" ? value : nameTh;
    const nextEn = field === "en" ? value : nameEn;
    if (field === "th") setNameTh(value);
    else setNameEn(value);

    if (!slugTouched) {
      setSlug(suggestSlug(nextEn, nextTh, eventDate ? new Date(eventDate) : undefined));
    }
  }

  function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setMessage(null);
    setErrors({});

    startTransition(async () => {
      const result = await createEventAction({
        nameTh,
        nameEn,
        slug,
        category,
        venueName,
        eventDate,
        morningStart,
        morningEnd,
        morningQuota: Number(morningQuota),
        afternoonStart,
        afternoonEnd,
        afternoonQuota: Number(afternoonQuota),
      });

      setMessage({ ok: result.ok, text: result.message });
      setErrors(result.fieldErrors ?? {});

      if (result.ok) {
        router.push("/admin/settings");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="ชื่องาน (ภาษาไทย)" required error={errors.nameTh}>
        <input
          className={FIELD}
          value={nameTh}
          onChange={(e) => updateName(e.target.value, "th")}
          placeholder="เช่น TNN Open House 2026"
        />
      </Field>

      <Field label="ชื่องาน (ภาษาอังกฤษ)" hint="ไม่บังคับ — ใช้แสดงเมื่อผู้ใช้เลือกภาษาอังกฤษ">
        <input
          className={FIELD}
          value={nameEn}
          onChange={(e) => updateName(e.target.value, "en")}
          placeholder="TNN Open House 2026"
        />
      </Field>

      <Field
        label="ชื่อลิงก์"
        required
        error={errors.slug}
        hint="ใช้ได้เฉพาะ a-z ตัวเลข และขีดกลาง — ระบบเดาให้จากชื่องาน แก้ได้"
      >
        <input
          className={`${FIELD} font-mono text-sm`}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="tnn-open-house-2026"
        />
        <p className="text-xs text-muted mt-1 break-all">
          ที่อยู่เว็บของงานนี้จะเป็น <span className="font-mono">/e/{slug || "…"}</span>
        </p>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="หมวดหมู่" hint="ไม่บังคับ">
          <input
            className={FIELD}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="สัมมนา"
          />
        </Field>

        <Field label="สถานที่จัดงาน" hint="ไม่บังคับ — แก้เพิ่มได้ที่หน้าตั้งค่างาน">
          <input
            className={FIELD}
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="อาคาร TNN ชั้น 5"
          />
        </Field>
      </div>

      <Field label="วันที่จัดงาน" required error={errors.eventDate}>
        <input
          type="date"
          className={FIELD}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </Field>

      <fieldset className="rounded-[var(--radius-card)] border border-line p-4 flex flex-col gap-4">
        <legend className="px-1 text-sm font-semibold text-ink">ภาคเช้า</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="เวลาเริ่ม">
            <input
              type="time"
              className={FIELD}
              value={morningStart}
              onChange={(e) => setMorningStart(e.target.value)}
            />
          </Field>
          <Field label="เวลาสิ้นสุด" error={errors.morningEnd}>
            <input
              type="time"
              className={FIELD}
              value={morningEnd}
              onChange={(e) => setMorningEnd(e.target.value)}
            />
          </Field>
          <Field label="จำนวนที่นั่ง" error={errors.morningQuota}>
            <input
              type="number"
              inputMode="numeric"
              className={FIELD}
              value={morningQuota}
              onChange={(e) => setMorningQuota(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-[var(--radius-card)] border border-line p-4 flex flex-col gap-4">
        <legend className="px-1 text-sm font-semibold text-ink">ภาคบ่าย</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="เวลาเริ่ม" error={errors.afternoonStart}>
            <input
              type="time"
              className={FIELD}
              value={afternoonStart}
              onChange={(e) => setAfternoonStart(e.target.value)}
            />
          </Field>
          <Field label="เวลาสิ้นสุด" error={errors.afternoonEnd}>
            <input
              type="time"
              className={FIELD}
              value={afternoonEnd}
              onChange={(e) => setAfternoonEnd(e.target.value)}
            />
          </Field>
          <Field label="จำนวนที่นั่ง" error={errors.afternoonQuota}>
            <input
              type="number"
              inputMode="numeric"
              className={FIELD}
              value={afternoonQuota}
              onChange={(e) => setAfternoonQuota(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      {message && (
        <p
          role="status"
          className={`text-sm rounded-[var(--radius-control)] px-3 py-2 ${
            message.ok
              ? "bg-primary-light text-primary-dark"
              : "bg-surface-2 text-danger border border-line-strong"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center min-h-[var(--control-height)] px-7
            rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold
            hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {pending ? "กำลังสร้าง…" : "สร้างงาน"}
        </button>
        <p className="text-sm text-muted">
          งานใหม่จะเป็น <strong className="text-ink-2">ฉบับร่าง</strong> — คนทั่วไปยังเข้าไม่ได้
          จนกว่าจะเปลี่ยนเป็น “เผยแพร่แล้ว” ที่หน้าตั้งค่างาน
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-danger ms-1" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
