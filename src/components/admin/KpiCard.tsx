import Link from "next/link";

/**
 * การ์ดตัวเลขสรุปแถวบนสุดของ Dashboard
 *
 * tone = "alert" ใช้กับตัวเลขที่ "ไม่ควรมี" เช่น อีเมลส่งไม่สำเร็จ
 * ให้สะดุดตาเฉพาะตอนที่ค่ามากกว่า 0 จริง ๆ ไม่ใช่ทาสีแดงไว้ตลอดเวลา
 */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  href,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  href?: string;
  tone?: "normal" | "primary" | "alert";
}) {
  const alert = tone === "alert" && Number(value) > 0;
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums leading-tight ${
          alert ? "text-danger" : tone === "primary" ? "text-primary-dark" : "text-ink"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
        {unit ? <span className="text-base font-semibold ml-0.5">{unit}</span> : null}
      </p>
      {hint ? <p className="text-[11px] text-muted leading-snug">{hint}</p> : null}
    </>
  );

  const className = `bg-surface border rounded-[var(--radius-card)] px-4 py-3 flex flex-col gap-0.5 ${
    alert ? "border-danger-border bg-danger-bg" : "border-line"
  }`;

  return href ? (
    <Link href={href} className={`${className} hover:border-primary transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
