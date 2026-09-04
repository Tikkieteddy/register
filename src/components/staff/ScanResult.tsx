"use client";

import type { CheckInResult } from "@/app/actions/checkin";

/**
 * ผลการสแกน 3 กรณี ตามข้อกำหนด B1
 *   ✅ สำเร็จ  — จอเขียว
 *   ⚠️ ซ้ำ     — จอเหลือง
 *   ❌ ไม่ถูกต้อง — จอแดง
 *
 * ออกแบบให้อ่านได้จากระยะไกลและรู้ผลโดยไม่ต้องก้มมองจอ (มีเสียงและการสั่นประกอบ)
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ScanResult({
  result,
  offline,
  onPrint,
  onNext,
  onSearch,
  onWalkIn,
}: {
  result: CheckInResult;
  offline: boolean;
  onPrint: (format: "lanyard" | "wristband", isReprint: boolean) => void;
  onNext: () => void;
  onSearch: () => void;
  onWalkIn: () => void;
}) {
  const tone =
    result.status === "success"
      ? { bg: "bg-success-bg", border: "border-[color:var(--color-success)]", text: "text-success" }
      : result.status === "duplicate"
        ? { bg: "bg-warning-bg", border: "border-[color:var(--color-warning)]", text: "text-warning" }
        : { bg: "bg-[var(--color-danger-bg)]", border: "border-[color:var(--color-danger-border)]", text: "text-danger" };

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`${tone.bg} ${tone.border} border-2 rounded-[var(--radius-card)] p-5 flex flex-col gap-4`}
    >
      {result.status === "success" && (
        <>
          <div className="text-center">
            <div className="text-5xl" aria-hidden="true">✅</div>
            <p className={`${tone.text} font-semibold text-lg mt-1`}>เช็คอินสำเร็จ</p>
            {offline && (
              <p className="text-xs text-ink-2 mt-1">
                บันทึกในเครื่องแล้ว จะส่งขึ้นระบบอัตโนมัติเมื่อเน็ตกลับมา
              </p>
            )}
          </div>

          <p className="text-center text-2xl sm:text-3xl font-bold text-ink">
            {result.person.firstName} {result.person.lastName}
          </p>

          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted">อาชีพ</dt>
            <dd className="text-ink">{result.person.occupation ?? "-"}</dd>
            <dt className="text-muted">ช่วงเวลา</dt>
            <dd className="text-ink">{result.person.sessionNames.join(" · ") || "-"}</dd>
            <dt className="text-muted">รหัสลงทะเบียน</dt>
            <dd className="text-ink font-mono">{result.person.registrationCode}</dd>
            <dt className="text-muted">เวลาเช็คอิน</dt>
            <dd className="text-ink font-mono">{formatTime(result.checkedInAt)} น.</dd>
          </dl>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onPrint("lanyard", false)}
              className="min-h-[var(--control-height)] rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold"
            >
              🖨️ พิมพ์บัตรห้อยคอ
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPrint("wristband", false)}
                className="min-h-11 rounded-[var(--radius-pill)] border border-primary text-primary-dark bg-surface font-medium"
              >
                🎗️ ริสแบนด์
              </button>
              <button
                type="button"
                onClick={onNext}
                className="min-h-11 rounded-[var(--radius-pill)] border border-line-strong text-ink-2 bg-surface font-medium"
              >
                📷 สแกนคนถัดไป
              </button>
            </div>
          </div>
        </>
      )}

      {result.status === "duplicate" && (
        <>
          <div className="text-center">
            <div className="text-5xl" aria-hidden="true">⚠️</div>
            <p className={`${tone.text} font-semibold text-lg mt-1`}>เช็คอินไปแล้ว</p>
          </div>

          <p className="text-center text-2xl sm:text-3xl font-bold text-ink">
            {result.person.firstName} {result.person.lastName}
          </p>

          <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted">เช็คอินเมื่อ</dt>
            <dd className="text-ink font-mono">{formatTime(result.checkedInAt)} น.</dd>
            <dt className="text-muted">โดยเจ้าหน้าที่</dt>
            <dd className="text-ink">{result.byStaffName ?? "ไม่ทราบ"}</dd>
            <dt className="text-muted">ผ่านมาแล้ว</dt>
            <dd className="text-ink">{result.minutesAgo} นาที</dd>
          </dl>

          <p className="text-sm text-ink-2 bg-surface rounded-[var(--radius-control)] p-3">
            ถามผู้ร่วมงานว่าเคยผ่านจุดลงทะเบียนแล้วหรือยัง
            <br />
            ถ้าบอกว่ายัง อาจมีคนใช้ตั๋วซ้ำ — ขอดูบัตรประชาชนเทียบชื่อ แล้วแจ้งหัวหน้าทีม
            <br />
            ถ้าแค่ทำบัตรหาย กดพิมพ์บัตรซ้ำได้เลย
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPrint("lanyard", true)}
              className="min-h-[var(--control-height)] rounded-[var(--radius-pill)] border border-primary text-primary-dark bg-surface font-semibold"
            >
              🖨️ พิมพ์บัตรซ้ำ
            </button>
            <button
              type="button"
              onClick={onNext}
              className="min-h-[var(--control-height)] rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold"
            >
              📷 สแกนคนถัดไป
            </button>
          </div>
        </>
      )}

      {(result.status === "invalid" || result.status === "forbidden") && (
        <>
          <div className="text-center">
            <div className="text-5xl" aria-hidden="true">❌</div>
            <p className={`${tone.text} font-semibold text-lg mt-1`}>
              {result.status === "forbidden" ? "ไม่มีสิทธิ์เช็คอิน" : "ไม่พบข้อมูลการลงทะเบียน"}
            </p>
          </div>

          <p className="text-center text-ink-2">{result.reason}</p>

          {result.status === "invalid" && (
            <ul className="text-sm text-ink-2 bg-surface rounded-[var(--radius-control)] p-3 list-disc ps-5 space-y-1">
              <li>ตรวจว่าเป็น QR ของงานนี้หรือไม่</li>
              <li>ค้นหาด้วยชื่อหรือเบอร์โทรแทน</li>
              <li>ถ้าไม่ได้ลงทะเบียนมา ใช้ปุ่มลงทะเบียนหน้างาน</li>
            </ul>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onSearch}
              className="min-h-[var(--control-height)] rounded-[var(--radius-pill)] bg-primary text-primary-contrast font-semibold"
            >
              🔍 ค้นหาด้วยชื่อ
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onWalkIn}
                className="min-h-11 rounded-[var(--radius-pill)] border border-primary text-primary-dark bg-surface font-medium"
              >
                ➕ ลงทะเบียนหน้างาน
              </button>
              <button
                type="button"
                onClick={onNext}
                className="min-h-11 rounded-[var(--radius-pill)] border border-line-strong text-ink-2 bg-surface font-medium"
              >
                📷 สแกนใหม่
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
