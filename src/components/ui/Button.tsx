"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "solid" | "outline" | "soft";

/** ปุ่มทรงแคปซูล ตามภาพอ้างอิง — ทุกปุ่มสูงอย่างน้อย 48px กดง่ายบนมือถือ */
export function Button({
  children,
  variant = "solid",
  loading = false,
  fullWidth = false,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}) {
  const styles: Record<Variant, string> = {
    solid:
      "bg-primary text-primary-contrast hover:bg-primary-dark disabled:bg-surface-2 disabled:text-muted disabled:border disabled:border-line-strong",
    outline:
      "bg-surface text-primary-dark border border-primary hover:bg-primary-light disabled:text-muted disabled:border-line",
    soft: "bg-primary-light text-primary-dark hover:bg-[#ffe4d5] disabled:text-muted",
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 min-h-[var(--control-height)] px-6
        rounded-[var(--radius-pill)] font-semibold font-[family-name:var(--font-display)]
        transition-colors disabled:cursor-not-allowed
        ${styles[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        />
      )}
      {children}
    </button>
  );
}
