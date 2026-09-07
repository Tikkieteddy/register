"use client";

import type { ReactNode } from "react";

/** สไตล์ช่องกรอกมาตรฐานของหน้าตั้งค่า — รวมไว้ที่เดียวเพื่อให้ทุกแท็บหน้าตาเหมือนกัน */
export const FIELD =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

export function Labeled({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return (
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
  );
}

export function SaveButton({ pending, label = "บันทึก" }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 px-6 self-start rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
    >
      {pending ? "กำลังบันทึก…" : label}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 mt-1 accent-[var(--color-primary)]"
      />
      <span>
        <span className="text-ink-2">{label}</span>
        {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
