import Link from "next/link";
import { colorAt } from "./palette";

/**
 * กราฟแท่งแนวนอน เรียงจากมากไปน้อย (กราฟที่ 4 และกราฟที่ 5)
 *
 * ใช้ div ธรรมดาแทน SVG เพราะป้ายเป็นข้อความไทยยาว ๆ
 * ปล่อยให้เบราว์เซอร์ตัดบรรทัดเองอ่านง่ายกว่าการคำนวณตำแหน่งใน SVG
 */
export function HBarChart({
  items,
  maxRows = 12,
  hrefFor,
}: {
  items: { label: string; value: number }[];
  maxRows?: number;
  hrefFor?: (label: string) => string | undefined;
}) {
  if (items.length === 0) return null;

  const shown = items.slice(0, maxRows);
  const rest = items.slice(maxRows);
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="flex flex-col gap-2 min-w-[280px]">
      {shown.map((item, index) => {
        const pct = Math.round((item.value / total) * 1000) / 10;
        const href = hrefFor?.(item.label);
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-ink-2 leading-snug">{item.label}</span>
              <span className="text-xs font-semibold text-ink tabular-nums shrink-0">
                {item.value} <span className="text-muted font-normal">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background: colorAt(0),
                  // ไล่ความเข้มตามอันดับ ทำให้อ่านลำดับได้ทันทีโดยไม่ต้องใช้หลายสี
                  opacity: Math.max(1 - index * 0.07, 0.4),
                }}
              />
            </div>
          </>
        );
        return (
          <div key={item.label} className="flex flex-col gap-1">
            {href ? (
              <Link href={href} className="flex flex-col gap-1 hover:opacity-80">
                {row}
              </Link>
            ) : (
              row
            )}
          </div>
        );
      })}
      {rest.length > 0 ? (
        <p className="text-xs text-muted pt-1">
          และอีก {rest.length} รายการ รวม {rest.reduce((s, i) => s + i.value, 0)} คน
        </p>
      ) : null}
    </div>
  );
}
