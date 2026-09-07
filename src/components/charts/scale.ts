/**
 * เลือกค่าสูงสุดของแกน Y ให้เป็นตัวเลขที่อ่านง่าย และไม่สูงเกินข้อมูลจริงมากเกินไป
 *
 * ถ้าปัดขึ้นเป็นเลขหลักถัดไปตรง ๆ (เช่น 114 → 200) กราฟจะเตี้ยจนดูไม่ออกว่าต่างกันแค่ไหน
 * วิธีนี้เลือก "ระยะห่างต่อขีด" ที่สวยก่อน แล้วค่อยคำนวณว่าต้องใช้กี่ขีดจึงจะครอบข้อมูลพอดี
 * ข้อมูลสูงสุด 114 จึงได้แกน 0–120 (ขีดละ 30) แทนที่จะเป็น 0–200
 */

/** บันไดค่าที่คนอ่านตัวเลขแล้วเข้าใจทันที */
const LADDER = [1, 2, 2.5, 3, 4, 5, 7.5, 10];

function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;

  /**
   * ทุกกราฟในระบบนี้นับ "จำนวนคน" หรือ "จำนวนครั้ง" ซึ่งเป็นจำนวนเต็มเสมอ
   * ถ้าปล่อยให้ขั้นเป็นทศนิยม แกนจะขึ้นเลขอย่าง 2.5 คน ซึ่งไม่มีความหมาย
   * จึงตัดขั้นที่ทำให้ได้ค่าทศนิยมออก และบังคับให้ขั้นต่ำสุดคือ 1
   */
  const allowed = magnitude >= 10 ? LADDER : LADDER.filter((entry) => Number.isInteger(entry));
  const step = allowed.find((candidate) => normalized <= candidate) ?? 10;
  return Math.max(step * magnitude, 1);
}

export type Scale = { top: number; ticks: number[] };

/**
 * @param targetDivisions จำนวนเส้นแบ่งที่อยากได้ — ลองทีละค่าแล้วเก็บชุดที่แกนเตี้ยที่สุด
 *                        กราฟเส้นใช้ค่ามากได้ ส่วนกราฟแท่งที่มีที่ว่างน้อยกว่าใช้ค่าน้อย
 */
export function niceScale(maxValue: number, targetDivisions: number[] = [4, 5]): Scale {
  const safeMax = Math.max(1, maxValue);

  const best = targetDivisions
    .map((target) => {
      const step = niceStep(safeMax / target);
      // คำนวณจำนวนขีดจากขั้นที่เลือกได้ แทนที่จะยึดจำนวนขีดตายตัว
      // ทำให้ยอดแกนไม่สูงเกินข้อมูลจริงโดยไม่จำเป็น
      const divisions = Math.max(1, Math.ceil(safeMax / step));
      return { step, divisions, top: step * divisions };
    })
    .reduce((lowest, current) => (current.top < lowest.top ? current : lowest));

  return {
    top: best.top,
    ticks: Array.from({ length: best.divisions + 1 }, (_, i) => best.step * i),
  };
}
