"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateEventInfoAction } from "@/app/actions/admin/settings";
import { FIELD, Labeled, Notice, SaveButton } from "./fields";

export function EventInfoForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    nameTh: string;
    nameEn: string;
    descriptionTh: string;
    venueName: string;
    venueAddress: string;
    mapUrl: string;
    travelNote: string;
    organizerName: string;
    organizerPhone: string;
    organizerEmail: string;
    organizerLineId: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateEventInfoAction({ id, ...form });
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setNotice({ ok: result.ok, text: result.message });
          if (result.ok) router.refresh();
        });
      }}
      className="flex flex-col gap-4 max-w-3xl"
    >
      <Notice notice={notice} />

      <div className="grid sm:grid-cols-2 gap-3">
        <Labeled label="ชื่องาน (ภาษาไทย)" error={errors.nameTh}>
          <input className={FIELD} value={form.nameTh} onChange={(e) => set("nameTh", e.target.value)} />
        </Labeled>
        <Labeled label="ชื่องาน (ภาษาอังกฤษ)">
          <input className={FIELD} value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
        </Labeled>
      </div>

      <Labeled label="รายละเอียดงาน">
        <textarea
          rows={5}
          className={`${FIELD} py-2 leading-relaxed`}
          value={form.descriptionTh}
          onChange={(e) => set("descriptionTh", e.target.value)}
        />
      </Labeled>

      <fieldset className="grid sm:grid-cols-2 gap-3">
        <legend className="text-sm font-semibold text-ink mb-2">สถานที่จัดงาน</legend>
        <Labeled label="ชื่อสถานที่">
          <input className={FIELD} value={form.venueName} onChange={(e) => set("venueName", e.target.value)} />
        </Labeled>
        <Labeled label="ลิงก์แผนที่ (Google Maps)">
          <input className={FIELD} value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} />
        </Labeled>
        <Labeled label="ที่อยู่" className="sm:col-span-2">
          <input className={FIELD} value={form.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} />
        </Labeled>
        <Labeled
          label="วิธีเดินทาง"
          className="sm:col-span-2"
          hint="ข้อความนี้แสดงทั้งบนหน้าเว็บและในอีเมลยืนยัน — เขียนให้คนที่ไม่เคยไปอ่านแล้วไปถูก"
        >
          <textarea
            rows={2}
            className={`${FIELD} py-2`}
            value={form.travelNote}
            onChange={(e) => set("travelNote", e.target.value)}
          />
        </Labeled>
      </fieldset>

      <fieldset className="grid sm:grid-cols-2 gap-3">
        <legend className="text-sm font-semibold text-ink mb-2">ข้อมูลผู้จัดงาน</legend>
        <Labeled label="ชื่อผู้จัด">
          <input className={FIELD} value={form.organizerName} onChange={(e) => set("organizerName", e.target.value)} />
        </Labeled>
        <Labeled label="เบอร์ติดต่อ" hint="แสดงในอีเมลและหน้าตั๋ว สำหรับกรณีผู้ลงทะเบียนมีปัญหา">
          <input className={FIELD} value={form.organizerPhone} onChange={(e) => set("organizerPhone", e.target.value)} />
        </Labeled>
        <Labeled label="อีเมลติดต่อ">
          <input className={FIELD} value={form.organizerEmail} onChange={(e) => set("organizerEmail", e.target.value)} />
        </Labeled>
        <Labeled label="LINE ID">
          <input className={FIELD} value={form.organizerLineId} onChange={(e) => set("organizerLineId", e.target.value)} />
        </Labeled>
      </fieldset>

      <SaveButton pending={pending} label="บันทึกข้อมูลงาน" />
    </form>
  );
}
