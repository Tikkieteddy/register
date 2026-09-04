/**
 * เพิ่มงานลงปฏิทิน — ระดับ 1 ตามหัวข้อ 8.1 และคำตอบ Q21
 *
 * ระดับ 1 คือ "ลิงก์เพิ่มลงปฏิทิน" ที่ผู้ใช้ไม่ต้องล็อกอิน Google
 * ได้ประโยชน์ 90% โดยไม่ต้องรอ Google อนุมัติ OAuth หลายสัปดาห์
 *
 * รองรับ Google Calendar ผ่านลิงก์ และปฏิทินอื่นผ่านไฟล์ .ics
 */

export type CalendarEvent = {
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  url: string;
  /** ใช้เป็น UID ของนัด เพื่อให้ปฏิทินรู้ว่าเป็นนัดเดิมถ้าเพิ่มซ้ำ */
  uid: string;
};

/** รูปแบบเวลาของ Google Calendar และ iCalendar: 20261201T020000Z */
function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** ลิงก์เพิ่มลง Google Calendar — เปิดหน้า Google พร้อมกรอกข้อมูลให้เสร็จ กดบันทึกครั้งเดียวจบ */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.startsAt)}/${toUtcStamp(event.endsAt)}`,
    details: `${event.description}\n\nบัตรเข้างานออนไลน์: ${event.url}`,
    location: event.location,
    ctz: "Asia/Bangkok",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** ตัดบรรทัดตามข้อกำหนด RFC 5545 ที่ห้ามเกิน 75 octet ต่อบรรทัด */
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return chunks.join("\r\n");
}

/** หนีอักขระพิเศษตามข้อกำหนด iCalendar */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * สร้างไฟล์ .ics สำหรับ Apple Calendar / Outlook / ปฏิทินอื่นที่อ่านมาตรฐานนี้ได้
 *
 * ตั้งเตือนล่วงหน้า 2 ระดับ: 1 วัน และ 2 ชั่วโมง ตามที่ระบุไว้ในหัวข้อ 8.1
 */
export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Registration System//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(event.startsAt)}`,
    `DTEND:${toUtcStamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`${event.description}\n\nบัตรเข้างานออนไลน์: ${event.url}`)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${event.url}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    // เตือนล่วงหน้า 1 วัน
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`พรุ่งนี้: ${event.title}`)}`,
    "END:VALARM",
    // เตือนล่วงหน้า 2 ชั่วโมง
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`อีก 2 ชั่วโมง: ${event.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // iCalendar กำหนดให้ขึ้นบรรทัดใหม่ด้วย CRLF เสมอ
  return lines.map(foldLine).join("\r\n");
}
