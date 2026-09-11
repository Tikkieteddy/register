"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpMemberAction } from "@/app/actions/member";
import { Field, inputClass } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";

/**
 * ฟอร์มสมัครสมาชิกสำหรับผู้เข้าร่วมงาน
 *
 * บังคับเฉพาะ ชื่อ · นามสกุล · อีเมล ที่เหลือกรอกเพิ่มได้ตามสะดวก
 * เพราะยิ่งบังคับกรอกมาก คนยิ่งเลิกกลางคัน — ข้อมูลที่เหลือขอเพิ่มทีหลังได้
 */

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
};

const EMPTY: Draft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  website: "",
};

export function MemberSignUpForm({ photoUploadReady }: { photoUploadReady: boolean }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);

  const set = (key: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const result = await signUpMemberAction({ ...draft, consentPdpa: consent });
      if (!result.ok) {
        setErrors(result.fieldErrors);
        if (result.message) setBanner(result.message);
        // พาไปที่ช่องแรกที่ผิด เพื่อไม่ให้ต้องเลื่อนหาเองบนมือถือ
        const firstBad = Object.keys(result.fieldErrors)[0];
        if (firstBad) document.getElementById(firstBad)?.focus();
        return;
      }
      setDone(true);
    } catch {
      setBanner("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center py-4">
        <div
          aria-hidden="true"
          className="mx-auto size-14 rounded-full bg-primary-light flex items-center justify-center text-3xl"
        >
          ✓
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">สมัครสมาชิกเรียบร้อยแล้ว</h2>
          <p className="text-ink-2 text-sm mt-1 max-w-[44ch] mx-auto leading-relaxed">
            ครั้งหน้าที่สมัครเข้าร่วมงาน กรอกอีเมลเดิมได้เลย
            ไม่ต้องพิมพ์ข้อมูลซ้ำทั้งหมดอีก
          </p>
        </div>
        <Link
          href="/"
          className="self-center inline-flex items-center min-h-11 px-6 rounded-[var(--radius-pill)]
            border border-primary text-primary-dark hover:bg-primary-light transition-colors"
        >
          ดูงานที่เปิดรับลงทะเบียน
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {banner && (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[color:var(--color-danger-border)]
            bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-ink-2"
        >
          {banner}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="firstName" label="ชื่อ" required error={errors.firstName}>
          <input
            id="firstName"
            value={draft.firstName}
            onChange={(e) => set("firstName")(e.target.value)}
            autoComplete="given-name"
            className={inputClass(Boolean(errors.firstName))}
          />
        </Field>

        <Field id="lastName" label="นามสกุล" required error={errors.lastName}>
          <input
            id="lastName"
            value={draft.lastName}
            onChange={(e) => set("lastName")(e.target.value)}
            autoComplete="family-name"
            className={inputClass(Boolean(errors.lastName))}
          />
        </Field>
      </div>

      <Field
        id="email"
        label="อีเมล"
        required
        error={errors.email}
        helper="ใช้เป็นตัวระบุตัวตนตอนสมัครงาน และเป็นที่ส่งบัตรเข้างาน"
      >
        <input
          id="email"
          type="email"
          inputMode="email"
          value={draft.email}
          onChange={(e) => set("email")(e.target.value)}
          autoComplete="email"
          className={inputClass(Boolean(errors.email))}
        />
      </Field>

      <Field id="phone" label="เบอร์โทรศัพท์" error={errors.phone} helper="ไม่บังคับ">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => set("phone")(e.target.value)}
          autoComplete="tel"
          placeholder="08X XXX XXXX"
          className={inputClass(Boolean(errors.phone))}
        />
      </Field>

      <Field id="address" label="ที่อยู่" error={errors.address} helper="ไม่บังคับ">
        <textarea
          id="address"
          rows={3}
          value={draft.address}
          onChange={(e) => set("address")(e.target.value)}
          autoComplete="street-address"
          className={`${inputClass(Boolean(errors.address))} resize-y`}
        />
      </Field>

      {/*
        ช่องรูปโปรไฟล์จะโผล่ก็ต่อเมื่อที่เก็บไฟล์พร้อมใช้งานจริงเท่านั้น
        ⚠️ ห้ามแสดงช่องนี้ทิ้งไว้เฉย ๆ ตอนที่ยังตั้งค่าไม่เสร็จ
           เพราะคนจะเลือกรูป กดสมัคร แล้วเจอ error ทั้งที่ข้อมูลอื่นกรอกครบแล้ว
      */}
      {photoUploadReady ? (
        <Field id="photo" label="รูปโปรไฟล์" helper="ไม่บังคับ · ไฟล์ JPG หรือ PNG">
          <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass(false)} />
        </Field>
      ) : (
        <p className="text-sm text-muted">
          ยังไม่เปิดให้อัปโหลดรูปโปรไฟล์ในขณะนี้ — เพิ่มรูปภายหลังได้
        </p>
      )}

      {/* ช่องซ่อนดักบอท — คนมองไม่เห็นและโปรแกรมอ่านหน้าจอก็ข้ามไป */}
      <input
        type="text"
        name="website"
        value={draft.website}
        onChange={(e) => set("website")(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] size-px opacity-0"
      />

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-sm text-ink-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span>
            ยอมรับ
            <Link href="/privacy" className="text-primary-dark underline mx-1">
              นโยบายความเป็นส่วนตัว
            </Link>
            และยินยอมให้เก็บข้อมูลไว้ใช้ตอนสมัครเข้าร่วมงาน
            <span className="text-primary ml-1" aria-hidden="true">
              *
            </span>
          </span>
        </label>
        {errors.consentPdpa && (
          <p role="alert" className="text-danger text-sm">
            {errors.consentPdpa}
          </p>
        )}
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "กำลังบันทึก…" : "สมัครสมาชิก"}
      </Button>
    </form>
  );
}
