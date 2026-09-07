import { AXIS_COLOR, colorAt, LABEL_COLOR } from "./palette";
import { niceScale } from "./scale";

type Series = { name: string; points: { label: string; value: number }[]; color?: string };

/**
 * กราฟเส้น รองรับ 1–2 เส้นซ้อนกัน (กราฟที่ 1 และกราฟที่ 11)
 *
 * เขียนเป็น SVG เองแทนการใช้ไลบรารีกราฟ เพราะ:
 * ① ควบคุมการวางป้ายภาษาไทยได้เอง ไม่ต้องสู้กับค่า default ของไลบรารี
 * ② ไม่ต้องโหลด JavaScript เพิ่มฝั่งผู้ใช้ — หน้า Dashboard เปิดเร็วขึ้นมาก
 */
export function LineChart({
  series,
  height = 220,
  formatLabel,
}: {
  series: Series[];
  height?: number;
  formatLabel?: (label: string) => string;
}) {
  const first = series[0];
  if (!first || first.points.length === 0) return null;

  const count = first.points.length;
  // เผื่อความกว้างต่อจุดไม่ให้ป้ายวันที่ทับกัน แล้วให้กรอบเลื่อนแนวนอนแทน
  const stepX = Math.max(48, Math.min(96, 720 / Math.max(count - 1, 1)));
  const padLeft = 44;
  // เผื่อที่ให้ป้ายวันที่ของจุดสุดท้าย ซึ่งวางกึ่งกลางจุดจึงล้นออกไปครึ่งหนึ่ง
  const padRight = 28;
  const padTop = 12;
  const padBottom = 34;
  const plotW = stepX * Math.max(count - 1, 1);
  const width = padLeft + plotW + padRight;
  const plotH = height - padTop - padBottom;

  const maxValue = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const { top, ticks: gridValues } = niceScale(maxValue);

  const x = (i: number) => padLeft + i * stepX;
  const y = (v: number) => padTop + plotH - (v / top) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      className="max-w-none"
    >
      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={padLeft}
            y1={y(v)}
            x2={width - padRight}
            y2={y(v)}
            stroke={AXIS_COLOR}
            strokeWidth={v === 0 ? 1 : 0.5}
          />
          <text
            x={padLeft - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="10"
            fill={LABEL_COLOR}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {Math.round(v)}
          </text>
        </g>
      ))}

      {series.map((s, si) => {
        const stroke = s.color ?? colorAt(si);
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            {s.points.map((p, i) => (
              <circle key={p.label} cx={x(i)} cy={y(p.value)} r="3.5" fill={stroke}>
                <title>{`${formatLabel ? formatLabel(p.label) : p.label} · ${s.name} ${p.value}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {first.points.map((p, i) => (
        <text
          key={p.label}
          x={x(i)}
          y={height - 12}
          textAnchor="middle"
          fontSize="10"
          fill={LABEL_COLOR}
        >
          {formatLabel ? formatLabel(p.label) : p.label}
        </text>
      ))}
    </svg>
  );
}

/** คำอธิบายสีของแต่ละเส้น — แยกออกมาเพื่อให้ตัดบรรทัดตามความกว้างจอได้ */
export function ChartLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-full"
            style={{ background: item.color }}
          />
          {item.name}
        </li>
      ))}
    </ul>
  );
}
