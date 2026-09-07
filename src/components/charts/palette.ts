/**
 * จานสีของกราฟ
 *
 * ทุกกราฟใช้ #EC5F27 เป็นสีหลักตามข้อกำหนดหัวข้อ 3.5
 * เฉดที่เหลือไล่จากสีหลักไปทางเข้มและอ่อน เพื่อให้กราฟหลายชิ้นยังอ่านออกได้
 * โดยไม่ต้องใช้สีที่ขัดกับ CI
 *
 * ⚠️ ห้ามใช้สีแดง #D32F2F ในกราฟ เพราะสงวนไว้สำหรับข้อความ error เท่านั้น
 */
export const CHART_COLORS = [
  "#ec5f27",
  "#c94a18",
  "#f5915f",
  "#9c3a12",
  "#fbc0a0",
  "#6d2a0d",
  "#d97441",
  "#ffd9c4",
] as const;

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}

/** สีสำหรับ "ส่วนที่ยังไม่เกิดขึ้น" เช่น คนที่ยังไม่มา หรือที่นั่งคงเหลือ */
export const MUTED_FILL = "#e7dfd7";

export const AXIS_COLOR = "#d6ccc2";
export const LABEL_COLOR = "#857a71";
