import { formatDateRange, formatTimeRange } from "@/lib/datetime";

/**
 * เทมเพลตอีเมลยืนยันการลงทะเบียน ตามข้อกำหนด A2
 *
 * ⚠️ ข้อกำหนดทางเทคนิคของอีเมล HTML ต่างจากเว็บมาก:
 *    - ต้องใช้ตาราง (table) จัดเลย์เอาต์ เพราะ Outlook ไม่รองรับ flexbox/grid
 *    - ต้องใส่ style แบบ inline เพราะโปรแกรมอีเมลหลายตัวตัด <style> ทิ้ง
 *    - ต้องมี plain-text สำรองเสมอ สำหรับโปรแกรมที่ไม่รับ HTML
 */

const PRIMARY = "#EC5F27";
const PRIMARY_DARK = "#C94A18";
const PRIMARY_LIGHT = "#FFF1EA";
const INK = "#1C1714";
const INK_2 = "#4A423C";
const MUTED = "#857A71";
const LINE = "#E7DFD7";

export type ConfirmationEmailData = {
  firstName: string;
  lastName: string;
  registrationCode: string;
  ticketCode: string;
  eventName: string;
  /** ช่วงเวลาที่ผู้ลงทะเบียนเลือกจริง — เช้า / บ่าย / ทั้งวัน */
  sessions: { nameTh: string; startsAt: Date; endsAt: Date }[];
  eventStartsAt: Date;
  eventEndsAt: Date;
  venueName: string;
  venueAddress: string;
  mapUrl: string | null;
  travelNote: string | null;
  organizerName: string;
  organizerPhone: string | null;
  organizerEmail: string | null;
  /** URL ของภาพ QR — ฝังในอีเมลและแนบเป็นไฟล์ด้วย */
  qrImageUrl: string;
  ticketUrl: string;
  calendarUrl: string;
  cancelUrl: string;
  privacyUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function confirmationSubject(data: ConfirmationEmailData): string {
  return `[ยืนยันการลงทะเบียน] ${data.eventName} — รหัส ${data.registrationCode}`;
}

/** ข้อความช่วงเวลาที่ผู้ลงทะเบียนเลือก แสดงเฉพาะช่วงที่เลือกจริงเท่านั้น */
function sessionLines(data: ConfirmationEmailData): string[] {
  if (data.sessions.length === 0) {
    return [formatTimeRange(data.eventStartsAt, data.eventEndsAt)];
  }
  return data.sessions.map((s) => `${s.nameTh} ${formatTimeRange(s.startsAt, s.endsAt)}`);
}

export function confirmationHtml(data: ConfirmationEmailData): string {
  const fullName = `${data.firstName} ${data.lastName}`;
  const dateText = formatDateRange(data.eventStartsAt, data.eventEndsAt);
  const times = sessionLines(data);

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;color:${MUTED};font-size:13px;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="th">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(confirmationSubject(data))}</title>
</head>
<body style="margin:0;padding:0;background:#FCFAF7;font-family:'Sarabun','Noto Sans Thai',Tahoma,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">ลงทะเบียนสำเร็จแล้ว รหัส ${escapeHtml(data.registrationCode)} — แสดง QR Code นี้ที่จุดลงทะเบียนในวันงาน</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FCFAF7;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">

    <tr><td style="background:${PRIMARY};padding:20px 28px;">
      <div style="color:#FFFFFF;font-size:18px;font-weight:700;">${escapeHtml(data.organizerName)}</div>
    </td></tr>

    <tr><td style="padding:28px 28px 8px;">
      <h1 style="margin:0 0 8px;color:${INK};font-size:20px;font-weight:700;line-height:1.4;">
        ขอบคุณสำหรับการลงทะเบียน คุณ${escapeHtml(fullName)}
      </h1>
      <p style="margin:0;color:${INK_2};font-size:15px;line-height:1.7;">
        คุณได้ลงทะเบียนเข้าร่วมงาน <strong style="color:${INK};">${escapeHtml(data.eventName)}</strong> เรียบร้อยแล้ว
      </p>
    </td></tr>

    <tr><td style="padding:16px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PRIMARY_LIGHT};border-radius:8px;">
        <tr><td style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${row("วันที่", escapeHtml(dateText))}
            ${row("เวลา", times.map(escapeHtml).join("<br />"))}
            ${row("สถานที่", escapeHtml(data.venueName))}
            ${row("ที่อยู่", escapeHtml(data.venueAddress).replace(/\n/g, "<br />"))}
            ${data.travelNote ? row("การเดินทาง", escapeHtml(data.travelNote)) : ""}
          </table>
          ${
            data.mapUrl
              ? `<div style="margin-top:12px;"><a href="${escapeHtml(data.mapUrl)}" style="color:${PRIMARY_DARK};font-size:14px;font-weight:600;text-decoration:underline;">เปิดแผนที่ใน Google Maps</a></div>`
              : ""
          }
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="padding:8px 28px 4px;">
      <p style="margin:0 0 12px;color:${INK_2};font-size:14px;">แสดง QR Code นี้ที่จุดลงทะเบียนในวันงาน</p>
      <img src="${escapeHtml(data.qrImageUrl)}" width="200" height="200" alt="QR Code สำหรับเช็คอิน รหัส ${escapeHtml(data.ticketCode)}" style="display:block;width:200px;height:200px;border:1px solid ${LINE};border-radius:8px;" />
      <div style="margin-top:8px;color:${MUTED};font-size:12px;font-family:monospace;letter-spacing:1px;">${escapeHtml(data.ticketCode)}</div>
    </td></tr>

    <tr><td align="center" style="padding:12px 28px;">
      <div style="color:${MUTED};font-size:13px;">รหัสผู้ลงทะเบียน</div>
      <div style="color:${PRIMARY_DARK};font-size:26px;font-weight:700;letter-spacing:3px;font-family:monospace;">${escapeHtml(data.registrationCode)}</div>
      <div style="color:${MUTED};font-size:12px;margin-top:4px;">แจ้งรหัสนี้ได้หากสแกน QR ไม่ติด</div>
    </td></tr>

    <tr><td align="center" style="padding:8px 28px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td style="background:${PRIMARY};border-radius:999px;">
          <a href="${escapeHtml(data.ticketUrl)}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">ดูบัตรเข้างานออนไลน์</a>
        </td></tr>
      </table>
      <div style="margin-top:12px;">
        <a href="${escapeHtml(data.calendarUrl)}" style="color:${PRIMARY_DARK};font-size:14px;text-decoration:underline;">เพิ่มลงปฏิทินของฉัน</a>
      </div>
    </td></tr>

    <tr><td style="padding:0 28px 20px;">
      <div style="border-top:1px solid ${LINE};padding-top:16px;">
        <div style="color:${INK};font-size:15px;font-weight:600;margin-bottom:8px;">สิ่งที่ต้องเตรียมในวันงาน</div>
        <ul style="margin:0;padding-left:20px;color:${INK_2};font-size:14px;line-height:1.8;">
          <li>มาถึงก่อนเวลาเริ่มงานอย่างน้อย 30 นาที</li>
          <li>เปิด QR Code จากอีเมลฉบับนี้ หรือจากบัตรเข้างานออนไลน์</li>
          <li>เพิ่มความสว่างหน้าจอให้สุด จะสแกนติดเร็วขึ้นมาก</li>
        </ul>
      </div>
    </td></tr>

    <tr><td style="padding:0 28px 24px;">
      <div style="border-top:1px solid ${LINE};padding-top:16px;color:${INK_2};font-size:14px;line-height:1.8;">
        <div style="color:${INK};font-weight:600;margin-bottom:4px;">มีข้อสงสัย ติดต่อผู้จัดงาน</div>
        ${data.organizerPhone ? `<div>โทร. ${escapeHtml(data.organizerPhone)}</div>` : ""}
        ${data.organizerEmail ? `<div>${escapeHtml(data.organizerEmail)}</div>` : ""}
      </div>
    </td></tr>

    <tr><td style="background:#F6F1EC;padding:18px 28px;color:${MUTED};font-size:12px;line-height:1.7;">
      <div>อีเมลฉบับนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</div>
      <div style="margin-top:6px;">
        <a href="${escapeHtml(data.privacyUrl)}" style="color:${MUTED};text-decoration:underline;">นโยบายความเป็นส่วนตัว</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(data.cancelUrl)}" style="color:${MUTED};text-decoration:underline;">ยกเลิกการลงทะเบียน</a>
      </div>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/** ข้อความสำรองสำหรับโปรแกรมอีเมลที่ไม่รับ HTML */
export function confirmationText(data: ConfirmationEmailData): string {
  const times = sessionLines(data);
  return [
    `ขอบคุณสำหรับการลงทะเบียน คุณ${data.firstName} ${data.lastName}`,
    "",
    `คุณได้ลงทะเบียนเข้าร่วมงาน ${data.eventName} เรียบร้อยแล้ว`,
    "",
    `วันที่: ${formatDateRange(data.eventStartsAt, data.eventEndsAt)}`,
    `เวลา: ${times.join(" / ")}`,
    `สถานที่: ${data.venueName}`,
    `ที่อยู่: ${data.venueAddress}`,
    data.mapUrl ? `แผนที่: ${data.mapUrl}` : "",
    "",
    `รหัสผู้ลงทะเบียน: ${data.registrationCode}`,
    `รหัสตั๋ว: ${data.ticketCode}`,
    "",
    `ดูบัตรเข้างานออนไลน์: ${data.ticketUrl}`,
    `เพิ่มลงปฏิทิน: ${data.calendarUrl}`,
    "",
    "สิ่งที่ต้องเตรียมในวันงาน",
    "- มาถึงก่อนเวลาเริ่มงานอย่างน้อย 30 นาที",
    "- เปิด QR Code จากอีเมลฉบับนี้ หรือจากบัตรเข้างานออนไลน์",
    "- เพิ่มความสว่างหน้าจอให้สุด จะสแกนติดเร็วขึ้นมาก",
    "",
    data.organizerPhone ? `ติดต่อผู้จัดงาน โทร. ${data.organizerPhone}` : "",
    data.organizerEmail ?? "",
    "",
    `ยกเลิกการลงทะเบียน: ${data.cancelUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
