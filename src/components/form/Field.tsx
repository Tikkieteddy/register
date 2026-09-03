"use client";

import type { ReactNode } from "react";

/**
 * โครงของฟิลด์ 1 ช่อง — label, ดอกจันสีส้ม, helper text, และข้อความ error
 *
 * ตำแหน่ง error ถอดจากภาพอ้างอิงที่ 3 และ 4 โดยตรง:
 *   • ช่องกรอกข้อความ / dropdown → error อยู่ "ใต้" ฟิลด์
 *   • กลุ่ม radio / checkbox      → error อยู่ "เหนือ" กลุ่มตัวเลือก (ใต้ label ทันที)
 * เพราะกลุ่มตัวเลือกไม่มีกรอบให้เปลี่ยนสีบอกความผิดพลาด
 */
export function Field({
  id,
  label,
  required = false,
  helper,
  error,
  errorPosition = "below",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  errorPosition?: "below" | "above";
  children: ReactNode;
}) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const errorNode = error ? (
    <p id={errorId} role="alert" className="text-danger text-sm">
      {error}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-2 font-medium">
        {label}
        {required && (
          <span className="text-primary ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only">(จำเป็นต้องกรอก)</span>}
      </label>

      {errorPosition === "above" && errorNode}
      {children}
      {errorPosition === "below" && errorNode}

      {helper && (
        <p id={helperId} className="text-sm text-muted italic">
          {helper}
        </p>
      )}
    </div>
  );
}

/** คลาสของช่องกรอก — แยกออกมาเพื่อให้ input ทุกชนิดหน้าตาตรงกัน */
export function inputClass(hasError: boolean): string {
  return `w-full min-h-[var(--control-height)] px-3.5 rounded-[var(--radius-control)]
    bg-surface text-ink border transition-colors
    placeholder:text-muted
    ${
      hasError
        ? "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]"
        : "border-line-strong hover:border-muted"
    }`;
}
