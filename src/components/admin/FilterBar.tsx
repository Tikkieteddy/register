"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * แถบค้นหาและตัวกรองของหน้ารายชื่อ (หัวข้อ 3.3)
 *
 * เก็บสถานะตัวกรองไว้ใน URL ทั้งหมด ไม่เก็บใน state ของ React
 * เพื่อให้ ① กดปุ่มย้อนกลับได้ ② ส่งลิงก์ที่กรองไว้แล้วให้เพื่อนร่วมงานได้
 * ③ ปุ่ม Export ใช้ตัวกรองชุดเดียวกันได้โดยไม่ต้องส่งค่าซ้ำ
 */
type Option = { value: string; label: string };

const FIELD_CLASS =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

export function FilterBar({
  sessions,
  occupations,
  total,
}: {
  sessions: Option[];
  occupations: string[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = useMemo(() => new URLSearchParams(params?.toString() ?? ""), [params]);

  function apply(key: string, value: string) {
    const next = new URLSearchParams(current.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // เปลี่ยนตัวกรองแล้วต้องกลับไปหน้าแรกเสมอ ไม่งั้นจะค้างอยู่หน้า 7 ของผลลัพธ์ที่มี 2 หน้า
    next.delete("page");
    router.push(`/admin-cms/registrations?${next.toString()}`);
  }

  const hasFilter = ["q", "checkin", "session", "email", "source", "occupation", "from", "to"].some(
    (key) => current.get(key),
  );

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          apply("q", typeof value === "string" ? value.trim() : "");
        }}
        className="flex gap-2"
      >
        <input
          name="q"
          defaultValue={current.get("q") ?? ""}
          placeholder="ค้นหา ชื่อ · นามสกุล · อีเมล · เบอร์โทร · รหัสลงทะเบียน"
          className={`${FIELD_CLASS} flex-1`}
          type="search"
        />
        <button
          type="submit"
          className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark"
        >
          ค้นหา
        </button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">สถานะ</span>
          <select
            className={FIELD_CLASS}
            defaultValue={current.get("checkin") ?? ""}
            onChange={(e) => apply("checkin", e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="in">เช็คอินแล้ว</option>
            <option value="out">ยังไม่มา</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">ช่วงเวลา</span>
          <select
            className={FIELD_CLASS}
            defaultValue={current.get("session") ?? ""}
            onChange={(e) => apply("session", e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {sessions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">สถานะอีเมล</span>
          <select
            className={FIELD_CLASS}
            defaultValue={current.get("email") ?? ""}
            onChange={(e) => apply("email", e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="sent">ส่งสำเร็จ</option>
            <option value="queued">รอส่ง</option>
            <option value="failed">ส่งไม่สำเร็จ</option>
            <option value="bounced">ตีกลับ</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">แหล่งที่มา</span>
          <select
            className={FIELD_CLASS}
            defaultValue={current.get("source") ?? ""}
            onChange={(e) => apply("source", e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="online">ลงทะเบียนออนไลน์</option>
            <option value="walkin">ลงทะเบียนหน้างาน</option>
            <option value="admin_manual">ผู้ดูแลเพิ่มให้</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">ลงทะเบียนตั้งแต่</span>
          <input
            type="date"
            className={FIELD_CLASS}
            defaultValue={current.get("from") ?? ""}
            onChange={(e) => apply("from", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">ถึงวันที่</span>
          <input
            type="date"
            className={FIELD_CLASS}
            defaultValue={current.get("to") ?? ""}
            onChange={(e) => apply("to", e.target.value)}
          />
        </label>
      </div>

      {occupations.length > 0 ? (
        <label className="flex items-center gap-2">
          <span className="text-xs text-muted shrink-0">อาชีพ</span>
          <select
            className={`${FIELD_CLASS} max-w-xs`}
            defaultValue={current.get("occupation") ?? ""}
            onChange={(e) => apply("occupation", e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {occupations.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          พบ <strong className="text-ink tabular-nums">{total.toLocaleString("th-TH")}</strong> รายการ
        </p>
        {hasFilter ? (
          <button
            type="button"
            onClick={() => router.push("/admin-cms/registrations")}
            className="text-sm text-primary-dark hover:underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        ) : null}
      </div>
    </div>
  );
}
