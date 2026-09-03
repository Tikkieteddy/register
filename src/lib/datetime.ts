/**
 * จัดรูปแบบวันเวลาเป็นภาษาไทย โซนเวลา Asia/Bangkok
 *
 * ⚠️ ต้องระบุ timeZone ทุกครั้ง ไม่งั้นเซิร์ฟเวอร์ที่รันในโซน UTC
 *    จะแสดงเวลาผิดไป 7 ชั่วโมง
 */
const TZ = "Asia/Bangkok";

export function formatThaiDate(date: Date, locale: "th" | "en" = "th"): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatTime(date: Date, locale: "th" | "en" = "th"): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(date);
}

/** ช่วงเวลาแบบ "09:00 - 12:00 น. (UTC+7)" ตามภาพอ้างอิง */
export function formatTimeRange(start: Date, end: Date, locale: "th" | "en" = "th"): string {
  const range = `${formatTime(start, locale)} - ${formatTime(end, locale)}`;
  return locale === "th" ? `${range} น. (UTC+7)` : `${range} (UTC+7)`;
}

/** ช่วงวันที่ ยุบเป็นวันเดียวถ้าเริ่มและจบวันเดียวกัน */
export function formatDateRange(start: Date, end: Date, locale: "th" | "en" = "th"): string {
  const sameDay =
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(start) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(end);
  return sameDay
    ? formatThaiDate(start, locale)
    : `${formatThaiDate(start, locale)} - ${formatThaiDate(end, locale)}`;
}

/**
 * ปีปัจจุบันตามปฏิทินของภาษาที่เลือก
 *
 * ภาษาไทยใช้ พ.ศ. เพื่อให้สอดคล้องกับวันที่งานที่แสดงเป็น พ.ศ. ทั้งหน้า
 * ไม่งั้นจะเกิดกรณีหน้าเดียวมีทั้ง "1 ธันวาคม 2569" และ "© 2026"
 */
export function currentYear(locale: "th" | "en" = "th"): string {
  // ใช้ formatToParts เพื่อเอาเฉพาะตัวเลขปี
  // เพราะ th-TH จะเติมคำว่า "พ.ศ." มาให้ด้วย ซึ่งอ่านแปลกเมื่อต่อท้ายเครื่องหมาย ©
  const parts = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    year: "numeric",
    timeZone: TZ,
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "year")?.value ?? String(new Date().getFullYear());
}
