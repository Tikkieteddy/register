"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelRegistrationsAction,
  resendEmailsAction,
} from "@/app/actions/admin/registrations";

export type Row = {
  id: string;
  registrationCode: string;
  fullName: string;
  email: string;
  phone: string;
  sessionNames: string | null;
  status: string;
  source: string;
  checkedInCount: number;
  emailStatus: string | null;
  createdAtLabel: string;
};

/** ป้ายสถานะ — สีต้องสื่อความหมายทันทีโดยไม่ต้องอ่านข้อความ */
function StatusBadge({ row }: { row: Row }) {
  if (row.status === "cancelled") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-danger-bg text-danger">ยกเลิก</span>;
  }
  if (row.checkedInCount > 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
        เช็คอินแล้ว
      </span>
    );
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">ยังไม่มา</span>;
}

const EMAIL_LABEL: Record<string, string> = {
  sent: "ส่งสำเร็จ",
  queued: "รอส่ง",
  failed: "ส่งไม่สำเร็จ",
  bounced: "ตีกลับ",
  complained: "ถูกร้องเรียน",
};

const SOURCE_LABEL: Record<string, string> = {
  online: "ออนไลน์",
  walkin: "หน้างาน",
  admin_manual: "ผู้ดูแลเพิ่ม",
};

export function RegistrationsTable({
  rows,
  filterQuery,
}: {
  rows: Row[];
  /** query string ของตัวกรองปัจจุบัน ใช้ต่อท้าย URL ของ Export */
  filterQuery: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function runResend() {
    const ids = [...selected];
    startTransition(async () => {
      const result = await resendEmailsAction(ids);
      setNotice({ ok: result.ok, text: result.message });
      router.refresh();
    });
  }

  function runCancel() {
    const ids = [...selected];
    const reason = window.prompt(
      `ยกเลิกการลงทะเบียน ${ids.length} รายการ และคืนที่นั่งเข้าระบบ\n\nระบุเหตุผล (บันทึกลง audit log):`,
      "ยกเลิกโดยผู้ดูแลระบบ",
    );
    if (reason === null) return;

    startTransition(async () => {
      const result = await cancelRegistrationsAction(ids, reason);
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* แถบเครื่องมือเมื่อเลือกหลายรายการ */}
      <div className="flex flex-wrap items-center gap-2 min-h-11">
        {selected.size > 0 ? (
          <>
            <span className="text-sm text-ink font-medium">เลือกไว้ {selected.size} รายการ</span>
            <button
              type="button"
              onClick={runResend}
              disabled={pending}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-primary text-primary-dark text-sm font-semibold hover:bg-primary-light disabled:opacity-50"
            >
              ส่งอีเมลซ้ำ
            </button>
            <a
              href={`/api/admin/export?format=xlsx&${filterQuery}${[...selected]
                .map((id) => `&id=${id}`)
                .join("")}`}
              className="min-h-11 inline-flex items-center px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2"
            >
              Export เฉพาะที่เลือก
            </a>
            <button
              type="button"
              onClick={runCancel}
              disabled={pending}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-danger-border text-danger text-sm font-semibold hover:bg-danger-bg disabled:opacity-50"
            >
              ยกเลิกการลงทะเบียน
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-muted hover:underline"
            >
              ล้างการเลือก
            </button>
          </>
        ) : (
          <span className="text-sm text-muted">
            ติ๊กช่องหน้ารายชื่อเพื่อส่งอีเมลซ้ำ · Export · หรือยกเลิกทีละหลายรายการ
          </span>
        )}
      </div>

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

      <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-surface">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="เลือกทั้งหมดในหน้านี้"
                  className="size-4 accent-[var(--color-primary)]"
                />
              </th>
              <th className="p-3 font-medium">ชื่อ-นามสกุล</th>
              <th className="p-3 font-medium">อีเมล</th>
              <th className="p-3 font-medium">ช่วงเวลา</th>
              <th className="p-3 font-medium">สถานะ</th>
              <th className="p-3 font-medium">อีเมล</th>
              <th className="p-3 font-medium">ที่มา</th>
              <th className="p-3 font-medium">ลงทะเบียนเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted">
                  ไม่พบรายการที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`เลือก ${row.fullName}`}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/registrations/${row.id}`}
                      className="text-ink font-medium hover:text-primary-dark hover:underline"
                    >
                      {row.fullName}
                    </Link>
                    <span className="block text-xs text-muted tabular-nums">
                      {row.registrationCode} · {row.phone}
                    </span>
                  </td>
                  <td className="p-3 text-ink-2 break-all max-w-[200px]">{row.email}</td>
                  <td className="p-3 text-ink-2">{row.sessionNames ?? "-"}</td>
                  <td className="p-3">
                    <StatusBadge row={row} />
                  </td>
                  <td className="p-3 text-xs">
                    {row.emailStatus ? (
                      <span
                        className={
                          row.emailStatus === "failed" || row.emailStatus === "bounced"
                            ? "text-danger font-medium"
                            : "text-muted"
                        }
                      >
                        {EMAIL_LABEL[row.emailStatus] ?? row.emailStatus}
                      </span>
                    ) : (
                      <span className="text-muted">ยังไม่ส่ง</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted">
                    {SOURCE_LABEL[row.source] ?? row.source}
                  </td>
                  <td className="p-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {row.createdAtLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
