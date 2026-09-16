/**
 * ทดสอบว่าอีเมลยืนยันแสดง QR Code ได้จริงในโปรแกรมอีเมลของผู้ลงทะเบียน
 *
 * รันด้วย:
 *   npx tsx tests/email-template.ts
 *
 * ⚠️ ทำไมต้องมีเทสต์นี้ — เคยพลาดมาแล้วจริง
 *
 *    เดิมโค้ดฝัง QR เป็น data URI (`<img src="data:image/png;base64,...">`)
 *    ซึ่ง Gmail และ Outlook บล็อกทิ้งเสมอ ผู้ลงทะเบียนจึงเห็นกรอบว่างแทน QR
 *    ทั้งที่อีเมลส่งถึงเรียบร้อย
 *
 *    ที่จับไม่ได้ตอนนั้น เพราะตอนพัฒนายังไม่ได้ตั้ง RESEND_API_KEY
 *    ระบบจึงใช้ตัวสำรองที่แค่เขียน log ไม่ได้ส่งออกจริง เทสต์เลยผ่านหมด
 *    กว่าจะรู้ก็ตอนผู้ใช้เปิด Gmail จริงแล้วไม่เห็น QR
 *
 * เทสต์นี้ไม่ต้องใช้ฐานข้อมูลและไม่ต้องเปิดเซิร์ฟเวอร์ รันได้ทันที
 */
import { readFileSync } from "node:fs";
import { confirmationHtml, confirmationText, type ConfirmationEmailData } from "@/lib/email/templates";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const QR_CID = "qr-REG12345";

const sample: ConfirmationEmailData = {
  firstName: "ทดสอบ",
  lastName: "ระบบ",
  registrationCode: "REG12345",
  ticketCode: "Y6T4WBPBVG8GK",
  eventName: "TNN Event 2026",
  sessions: [
    {
      nameTh: "ภาคเช้า",
      startsAt: new Date("2026-12-01T02:00:00Z"),
      endsAt: new Date("2026-12-01T05:00:00Z"),
    },
  ],
  eventStartsAt: new Date("2026-12-01T02:00:00Z"),
  eventEndsAt: new Date("2026-12-01T09:30:00Z"),
  venueName: "ห้องประชุมใหญ่",
  venueAddress: "กรุงเทพมหานคร",
  mapUrl: "https://maps.example.com/x",
  travelNote: null,
  organizerName: "TNN",
  organizerPhone: "020000000",
  organizerEmail: "event@example.com",
  qrImageUrl: `cid:${QR_CID}`,
  ticketUrl: "https://tnn-event.vercel.app/ticket/abc",
  calendarUrl: "https://calendar.example.com/x",
  cancelUrl: "https://tnn-event.vercel.app/ticket/abc/cancel",
  privacyUrl: "https://tnn-event.vercel.app/privacy",
};

console.log("① เนื้ออีเมลที่สร้างออกมา");

const html = confirmationHtml(sample);
const text = confirmationText(sample);

check(
  "ไม่มีรูปแบบ data URI หลงเหลืออยู่เลย",
  !html.includes("data:image"),
  "เจอ data:image ซึ่ง Gmail จะบล็อกทิ้ง",
);

check(
  "รูป QR อ้างถึงไฟล์แนบด้วย cid:",
  html.includes(`src="cid:${QR_CID}"`),
  "ไม่พบ <img src=\"cid:...\">",
);

check(
  "ยังมีรหัสบัตรเป็นตัวอักษรให้ใช้แทนตอนรูปไม่ขึ้น",
  html.includes(sample.ticketCode) && text.includes(sample.ticketCode),
);

check(
  "ยังมีลิงก์บัตรออนไลน์เป็นทางสำรอง",
  html.includes(sample.ticketUrl) && text.includes(sample.ticketUrl),
);

/**
 * ② ตรวจถึงจุดที่ประกอบอีเมลจริง
 *
 * ส่วนนี้อ่านจากซอร์สโค้ดโดยตรง ไม่ใช่การรันจริง เพราะฟังก์ชันประกอบอีเมล
 * ต้องต่อฐานข้อมูลเพื่อดึงข้อมูลบัตร ถ้าจะรันจริงต้องมีข้อมูลลงทะเบียนจริงก่อน
 * ซึ่งครอบคลุมอยู่แล้วใน e2e-full-flow — ตรงนี้จึงตรวจแค่ว่า "สายไฟต่อถูกเส้น"
 */
console.log("\n② การต่อสายระหว่างเทมเพลตกับตัวส่งอีเมล");

const root = new URL("..", import.meta.url).pathname;
const confirmationSrc = readFileSync(`${root}src/lib/email/confirmation.ts`, "utf-8");
const senderSrc = readFileSync(`${root}src/lib/email/sender.ts`, "utf-8");

check(
  "ตัวประกอบอีเมลส่ง cid: ให้เทมเพลต ไม่ใช่ data URI",
  /qrImageUrl:\s*`cid:\$\{/.test(confirmationSrc) && !confirmationSrc.includes("qrDataUrl"),
);

check(
  "ไฟล์ QR ที่แนบไปมีรหัสอ้างอิง (contentId) กำกับ",
  /contentId:\s*qrContentId/.test(confirmationSrc),
);

check(
  "ตัวส่งอีเมลส่ง contentId ต่อไปให้ Resend ไม่ตัดทิ้ง",
  /contentId:\s*a\.contentId/.test(senderSrc),
);

check(
  "ตัวส่งอีเมลส่ง contentType ต่อไปด้วย",
  /contentType:\s*a\.contentType/.test(senderSrc),
);

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
