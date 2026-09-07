import type { ReactNode } from "react";

/**
 * กรอบมาตรฐานของทุกกราฟ
 *
 * แยกออกมาเพื่อให้หัวข้อ คำอธิบาย และระยะห่างเหมือนกันทั้ง Dashboard
 * และเพื่อให้กราฟที่กว้างเลื่อนในกรอบตัวเองได้ ไม่ดันให้ทั้งหน้าเลื่อนซ้ายขวา
 */
export function ChartFrame({
  no,
  title,
  question,
  children,
  footer,
  className = "",
}: {
  no: number;
  title: string;
  question: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface border border-line rounded-[var(--radius-card)] p-4 sm:p-5 flex flex-col gap-3 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold text-primary-dark bg-primary-light rounded-full px-2 py-0.5 tabular-nums">
            {no}
          </span>
          <h3 className="text-sm sm:text-base font-semibold text-ink">{title}</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">{question}</p>
      </header>

      <div className="overflow-x-auto">{children}</div>

      {footer ? <div className="text-xs text-muted">{footer}</div> : null}
    </section>
  );
}

/** ข้อความแทนกราฟเมื่อยังไม่มีข้อมูล — ต้องบอกด้วยว่าข้อมูลจะมาเมื่อไร */
export function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="h-[180px] grid place-items-center text-center px-4">
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}
