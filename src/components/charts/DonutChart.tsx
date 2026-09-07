import { colorAt } from "./palette";

/**
 * กราฟโดนัทและวงกลม (กราฟที่ 2 · 6 · 10)
 *
 * วาดด้วย stroke-dasharray บนวงกลมเดียว แทนการคำนวณ path ของแต่ละชิ้น
 * เขียนสั้นกว่ามากและไม่มีปัญหาช่องว่างระหว่างชิ้นเวลามุมแคบ
 */
export function DonutChart({
  items,
  size = 168,
  thickness = 26,
  centerLabel,
  centerValue,
}: {
  items: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // คำนวณระยะเลื่อนของแต่ละชิ้นจากผลรวมของชิ้นก่อนหน้า
  // เขียนแบบไม่แก้ค่าตัวแปรระหว่าง render เพื่อให้ผลลัพธ์เหมือนเดิมทุกครั้งที่ React วาดซ้ำ
  const portions = items.map((item) => (item.value / total) * circumference);
  const segments = items.map((item, index) => ({
    item,
    index,
    portion: portions[index] ?? 0,
    offset: portions.slice(0, index).reduce((sum, p) => sum + p, 0),
  }));

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map(({ item, index, portion, offset }) => (
            <circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color ?? colorAt(index)}
              strokeWidth={thickness}
              strokeDasharray={`${portion} ${circumference - portion}`}
              strokeDashoffset={-offset}
            >
              <title>{`${item.label} ${item.value}`}</title>
            </circle>
          ))}
        </g>
        {centerValue ? (
          <>
            <text
              x={size / 2}
              y={size / 2 - 2}
              textAnchor="middle"
              fontSize="24"
              fontWeight="700"
              fill="#1c1714"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {centerValue}
            </text>
            <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fontSize="11" fill="#857a71">
              {centerLabel}
            </text>
          </>
        ) : null}
      </svg>

      <ul className="flex flex-col gap-1.5 min-w-[150px]">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-sm shrink-0"
              style={{ background: item.color ?? colorAt(index) }}
            />
            <span className="text-ink-2 flex-1">{item.label}</span>
            <span className="font-semibold text-ink tabular-nums">
              {item.value}
              <span className="text-muted font-normal">
                {" "}
                ({Math.round((item.value / total) * 1000) / 10}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
