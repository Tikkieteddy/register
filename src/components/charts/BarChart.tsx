import Link from "next/link";
import { AXIS_COLOR, colorAt, LABEL_COLOR, MUTED_FILL } from "./palette";
import { niceScale } from "./scale";

export type BarGroup = {
  label: string;
  /** ค่าหลัก เช่น จำนวนที่ลงทะเบียน */
  value: number;
  /** ค่าที่ซ้อนอยู่ข้างใน เช่น จำนวนที่มาจริง — ไม่ใส่ก็ได้ */
  inner?: number;
  /** ลิงก์ไปดูรายชื่อเบื้องหลังตัวเลขนี้ (drill-down ตามหัวข้อ 8.6) */
  href?: string;
};

/**
 * กราฟแท่งแนวตั้ง (กราฟที่ 3 และกราฟที่ 7)
 *
 * ถ้าใส่ค่า inner มาด้วย จะวาดแท่งทึบซ้อนในแท่งจาง
 * ทำให้เห็น "ลงทะเบียนกี่คน / มาจริงกี่คน" ในแท่งเดียวโดยไม่ต้องมี 2 แท่ง
 */
export function BarChart({
  groups,
  height = 220,
  barWidth = 46,
  innerLabel,
}: {
  groups: BarGroup[];
  height?: number;
  barWidth?: number;
  innerLabel?: string;
}) {
  if (groups.length === 0) return null;

  const gap = 22;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 18;
  const padBottom = 38;
  const plotH = height - padTop - padBottom;
  const width = padLeft + groups.length * (barWidth + gap) + padRight;

  const maxValue = Math.max(1, ...groups.map((g) => g.value));
  // กราฟแท่งมีที่ว่างแนวตั้งน้อยกว่ากราฟเส้น จึงใช้เส้นแบ่งน้อยกว่าเพื่อไม่ให้รก
  const { top, ticks } = niceScale(maxValue, [2, 3]);
  const y = (v: number) => padTop + plotH - (v / top) * plotH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" className="max-w-none">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padLeft} y1={y(v)} x2={width - padRight} y2={y(v)} stroke={AXIS_COLOR} strokeWidth={v === 0 ? 1 : 0.5} />
          <text x={padLeft - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill={LABEL_COLOR} style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(v)}
          </text>
        </g>
      ))}

      {groups.map((g, i) => {
        const bx = padLeft + gap / 2 + i * (barWidth + gap);
        const barTop = y(g.value);
        const bar = (
          <g>
            <rect x={bx} y={barTop} width={barWidth} height={Math.max(plotH - (barTop - padTop), 0)} rx="4" fill={g.inner === undefined ? colorAt(0) : MUTED_FILL} />
            {g.inner !== undefined ? (
              <rect x={bx} y={y(g.inner)} width={barWidth} height={Math.max(plotH - (y(g.inner) - padTop), 0)} rx="4" fill={colorAt(0)} />
            ) : null}
            <text x={bx + barWidth / 2} y={barTop - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1c1714" style={{ fontVariantNumeric: "tabular-nums" }}>
              {g.value}
            </text>
            <text x={bx + barWidth / 2} y={height - 20} textAnchor="middle" fontSize="11" fill="#4a423c">
              {g.label}
            </text>
            {g.inner !== undefined ? (
              <text x={bx + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="10" fill={LABEL_COLOR} style={{ fontVariantNumeric: "tabular-nums" }}>
                {innerLabel ? `${innerLabel} ${g.inner}` : g.inner}
              </text>
            ) : null}
            <title>{`${g.label} ${g.value}`}</title>
          </g>
        );
        return g.href ? (
          <Link key={g.label} href={g.href}>
            {bar}
          </Link>
        ) : (
          <g key={g.label}>{bar}</g>
        );
      })}
    </svg>
  );
}
