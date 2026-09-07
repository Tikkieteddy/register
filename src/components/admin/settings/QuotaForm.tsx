"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateQuotaAction } from "@/app/actions/admin/settings";
import { FIELD, Labeled, Notice, SaveButton, Toggle } from "./fields";

type SessionRow = {
  id: string;
  nameTh: string;
  quota: number;
  reservedCount: number;
  checkedInCount: number;
  isClosed: boolean;
};

/**
 * ตั้งค่าที่นั่งและการเปิด-ปิดรับลงทะเบียน (หัวข้อ 3.2)
 *
 * แสดง "จองไปแล้วกี่ที่" ข้างช่องกรอกโควตาเสมอ
 * เพราะข้อผิดพลาดที่อันตรายที่สุดคือการลดโควตาลงต่ำกว่าจำนวนที่รับไปแล้ว
 */
export function QuotaForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: {
    sessions: SessionRow[];
    seatHoldMinutes: number;
    allowWalkinOverQuota: boolean;
    waitlistEnabled: boolean;
    status: "draft" | "published" | "closed" | "archived";
    registrationOpensAt: string;
    registrationClosesAt: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSession(id: string, patch: Partial<SessionRow>) {
    setForm((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  const totalQuota = form.sessions.reduce((sum, s) => sum + s.quota, 0);
  const totalReserved = form.sessions.reduce((sum, s) => sum + s.reservedCount, 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateQuotaAction({
            eventId,
            sessions: form.sessions.map((s) => ({
              id: s.id,
              quota: s.quota,
              isClosed: s.isClosed,
            })),
            seatHoldMinutes: form.seatHoldMinutes,
            allowWalkinOverQuota: form.allowWalkinOverQuota,
            waitlistEnabled: form.waitlistEnabled,
            status: form.status,
            registrationOpensAt: form.registrationOpensAt,
            registrationClosesAt: form.registrationClosesAt,
          });
          setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
          setNotice({ ok: result.ok, text: result.message });
          if (result.ok) router.refresh();
        });
      }}
      className="flex flex-col gap-4 max-w-3xl"
    >
      <Notice notice={notice} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">จำนวนที่นั่งแต่ละช่วงเวลา</h2>
        {form.sessions.map((s) => (
          <div
            key={s.id}
            className="border border-line rounded-[var(--radius-card)] p-3 flex flex-wrap items-end gap-4"
          >
            <div className="min-w-[140px]">
              <p className="text-sm font-medium text-ink">{s.nameTh}</p>
              <p className="text-xs text-muted tabular-nums">
                จองไปแล้ว {s.reservedCount} · เช็คอินแล้ว {s.checkedInCount}
              </p>
            </div>

            <Labeled label="จำนวนที่นั่ง" className="w-32">
              {/*
                ตั้งใจไม่ใส่ min ของ HTML เพราะเบราว์เซอร์จะขึ้นข้อความเตือนภาษาอังกฤษ
                ที่บอกแค่ว่าค่าน้อยไป ไม่ได้บอกว่าทำไม
                ปล่อยให้เซิร์ฟเวอร์ปฏิเสธพร้อมข้อความไทยที่อธิบายเหตุผลแทน
              */}
              <input
                type="number"
                className={FIELD}
                value={s.quota}
                onChange={(e) => updateSession(s.id, { quota: Number(e.target.value) || 0 })}
              />
            </Labeled>

            <div className="pb-1">
              <Toggle
                checked={s.isClosed}
                onChange={(next) => updateSession(s.id, { isClosed: next })}
                label="ปิดรับช่วงนี้"
              />
            </div>

            {s.quota < s.reservedCount ? (
              <p className="w-full text-xs text-danger">
                ที่นั่งน้อยกว่าจำนวนที่จองไปแล้ว — บันทึกไม่ได้
                ต้องยกเลิกการลงทะเบียนบางรายการก่อน
              </p>
            ) : null}
          </div>
        ))}
        <p className="text-xs text-muted tabular-nums">
          รวมทั้งงาน {totalQuota} ที่นั่ง · จองแล้ว {totalReserved} · คงเหลือ{" "}
          {Math.max(totalQuota - totalReserved, 0)}
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <h2 className="text-sm font-semibold text-ink sm:col-span-2">การเปิด-ปิดรับลงทะเบียน</h2>

        <Labeled label="สถานะงาน" hint="ต้องเป็น “เผยแพร่แล้ว” คนทั่วไปจึงจะเห็นหน้าลงทะเบียน">
          <select
            className={FIELD}
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as typeof form.status })
            }
          >
            <option value="draft">ฉบับร่าง (ยังไม่เผยแพร่)</option>
            <option value="published">เผยแพร่แล้ว</option>
            <option value="closed">ปิดรับลงทะเบียน</option>
            <option value="archived">เก็บเข้าคลัง</option>
          </select>
        </Labeled>

        <Labeled
          label="เวลาจองที่นั่งชั่วคราว (นาที)"
          hint="ระยะเวลาที่กันที่นั่งไว้ระหว่างผู้ใช้กรอกฟอร์ม ค่าแนะนำคือ 15 นาที"
          error={errors.seatHoldMinutes}
        >
          <input
            type="number"
            min={5}
            max={60}
            className={FIELD}
            value={form.seatHoldMinutes}
            onChange={(e) => setForm({ ...form, seatHoldMinutes: Number(e.target.value) || 15 })}
          />
        </Labeled>

        <Labeled label="เปิดรับอัตโนมัติเมื่อ" hint="เว้นว่างได้ถ้าไม่ต้องการตั้งเวลา">
          <input
            type="datetime-local"
            className={FIELD}
            value={form.registrationOpensAt}
            onChange={(e) => setForm({ ...form, registrationOpensAt: e.target.value })}
          />
        </Labeled>

        <Labeled label="ปิดรับอัตโนมัติเมื่อ">
          <input
            type="datetime-local"
            className={FIELD}
            value={form.registrationClosesAt}
            onChange={(e) => setForm({ ...form, registrationClosesAt: e.target.value })}
          />
        </Labeled>
      </section>

      <section className="flex flex-col gap-2">
        <Toggle
          checked={form.allowWalkinOverQuota}
          onChange={(next) => setForm({ ...form, allowWalkinOverQuota: next })}
          label="อนุญาตให้ลงทะเบียนหน้างานเกินโควตาได้"
          hint="แนะนำให้เปิดไว้ เพราะหน้างานจริงต้องยืดหยุ่นเมื่อมีแขกสำคัญมาถึง"
        />
        <Toggle
          checked={form.waitlistEnabled}
          onChange={(next) => setForm({ ...form, waitlistEnabled: next })}
          label="เปิดรายชื่อสำรองเมื่อที่นั่งเต็ม"
          hint="เมื่อมีคนยกเลิก ระบบจะมีรายชื่อให้ติดต่อกลับทันที"
        />
      </section>

      <SaveButton pending={pending} label="บันทึกการตั้งค่าที่นั่ง" />
    </form>
  );
}
