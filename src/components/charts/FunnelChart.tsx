import { colorAt } from "./palette";

/**
 * กรวยการแปลง (กราฟที่ 9)
 *
 * แสดง "หลุดหายไปกี่คนระหว่างขั้น" ไว้ระหว่างแถบแต่ละขั้น
 * เพราะตัวเลขที่ Admin ต้องการจริง ๆ คือจุดที่คนหายมากที่สุด ไม่ใช่ยอดคงเหลือ
 */
export function FunnelChart({
  steps,
}: {
  steps: { label: string; value: number; note: string }[];
}) {
  const top = Math.max(1, ...steps.map((s) => s.value));

  return (
    <ol className="flex flex-col gap-1 min-w-[280px]">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1] : undefined;
        const dropped = previous ? previous.value - step.value : 0;
        const keptPct =
          previous && previous.value > 0
            ? Math.round((step.value / previous.value) * 1000) / 10
            : 100;

        return (
          <li key={step.label} className="flex flex-col">
            {previous ? (
              <div className="flex items-center gap-2 py-1 pl-1">
                <span aria-hidden="true" className="text-muted text-xs">
                  ↓
                </span>
                <span className="text-[11px] text-muted">
                  ผ่านต่อ {keptPct}%
                  {dropped > 0 ? ` · หลุดไป ${dropped.toLocaleString("th-TH")} คน` : ""}
                </span>
              </div>
            ) : null}

            <div
              className="rounded-[var(--radius-control)] px-3 py-2 flex items-center justify-between gap-3 text-primary-contrast"
              style={{
                background: colorAt(index),
                width: `${Math.max((step.value / top) * 100, 34)}%`,
                minWidth: "180px",
              }}
            >
              <span className="text-xs font-semibold">{step.label}</span>
              <span className="text-sm font-bold tabular-nums">
                {step.value.toLocaleString("th-TH")}
              </span>
            </div>
            <span className="text-[11px] text-muted pl-1 pt-0.5">{step.note}</span>
          </li>
        );
      })}
    </ol>
  );
}
