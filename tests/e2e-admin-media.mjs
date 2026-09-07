/**
 * ทดสอบหน้าจัดการภาพและสื่อ (เฟส 5 — หัวข้อ 8.4)
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-admin-media.mjs
 *
 * ครอบคลุม: อัปโหลดภาพจริง · แปลงเป็น WebP/AVIF และย่อหลายขนาด ·
 * เตือนเมื่อสัดส่วนภาพผิด · ปฏิเสธไฟล์ที่ไม่ใช่ภาพ ·
 * ลบสคริปต์ที่ฝังมาในไฟล์ SVG · บันทึกคำอธิบายภาพ (alt text)
 */
import { writeFileSync } from "node:fs";
import { launchBrowser } from "./browser.mjs";
import { deflateSync } from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

/** สร้างไฟล์ PNG สีเดียวขึ้นมาเอง เพื่อไม่ต้องเก็บไฟล์ภาพไว้ใน repo */
function makePng(path, w, h, rgb) {
  const raw = Buffer.concat(
    Array.from({ length: h }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))]),
    ),
  );
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

makePng("/tmp/uat-poster-ok.png", 1200, 1200, [236, 95, 39]);
makePng("/tmp/uat-poster-wrong.png", 300, 900, [28, 23, 20]);
writeFileSync(
  "/tmp/uat-logo-evil.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    '<script>alert(1)</script><rect width="200" height="200" fill="#EC5F27" onload="alert(2)"/></svg>',
);
writeFileSync("/tmp/uat-not-an-image.txt", "ไฟล์นี้ไม่ใช่ภาพ");

const b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
p.on("response", (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`); });

let fail = 0;
const log = (ok, m) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${m}`); };

await ctx.clearCookies();
await p.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }).waitFor({ timeout: 30000 });
await p.waitForTimeout(1200);
await p.getByLabel("อีเมล").fill("admin@example.com");
await p.getByLabel("รหัสผ่าน", { exact: true }).fill("admin-dev-1234");
await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
await p.waitForFunction(() => !location.pathname.startsWith("/staff/login"), null, { timeout: 30000 }).catch(() => {});

await p.goto(`${BASE}/admin/media`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "ภาพและสื่อ" }).waitFor({ timeout: 45000 });
await p.waitForTimeout(1200);

// ---------- ① อัปโหลดโปสเตอร์ที่ขนาดถูกต้อง ----------
console.log("\n① อัปโหลดภาพที่ขนาดถูกต้อง");
await p.locator('select[name="type"]').selectOption("poster");
await p.locator('input[type="file"]').setInputFiles("/tmp/uat-poster-ok.png");
await p.getByRole("button", { name: "อัปโหลด" }).click();
await p.waitForTimeout(9000);
log((await p.getByText("อัปโหลดเรียบร้อย").count()) > 0, "อัปโหลดโปสเตอร์ 1200×1200 สำเร็จ");
log((await p.getByText("1200×1200").count()) > 0, "อ่านความกว้าง-สูงของภาพมาเก็บไว้ถูกต้อง");
log(
  (await p.getByText("ยังไม่มีคำอธิบายภาพ").count()) > 0,
  "เตือนว่ายังไม่มีคำอธิบายภาพ (จำเป็นต่อคะแนนการเข้าถึง)",
);

const imgSrc = await p.locator("figure img").first().getAttribute("src");
log(Boolean(imgSrc?.endsWith(".webp")), `แปลงเป็น WebP และใช้แสดงผลจริง (${imgSrc?.slice(-24)})`);

const webpResponse = await p.request.get(`${BASE}${imgSrc}`);
log(webpResponse.ok(), "ไฟล์ WebP เปิดได้จริงจากที่เก็บไฟล์");

const avifResponse = await p.request.get(`${BASE}${imgSrc.replace(".webp", ".avif")}`);
log(avifResponse.ok(), "ไฟล์ AVIF ถูกสร้างไว้ด้วย");

for (const w of [400, 800]) {
  const variant = await p.request.get(`${BASE}${imgSrc.replace(".webp", `-${w}w.webp`)}`);
  log(variant.ok(), `สร้างภาพย่อขนาด ${w}px สำหรับ srcset แล้ว`);
}

// ---------- ② เตือนเมื่อสัดส่วนผิด ----------
console.log("\n② เตือนเมื่อภาพผิดสัดส่วน");
await p.locator('select[name="type"]').selectOption("poster");
await p.locator('input[type="file"]').setInputFiles("/tmp/uat-poster-wrong.png");
await p.getByRole("button", { name: "อัปโหลด" }).click();
await p.waitForTimeout(8000);
log(
  (await p.getByText(/สัดส่วนภาพไม่ตรงกับที่แนะนำ/).count()) > 0,
  "เตือนเมื่ออัปโหลดภาพผิดสัดส่วน พร้อมบอกขนาดที่ควรใช้",
);

// ---------- ③ ปฏิเสธไฟล์ที่ไม่ใช่ภาพ ----------
console.log("\n③ ความปลอดภัยของไฟล์");
await p.locator('input[type="file"]').setInputFiles("/tmp/uat-not-an-image.txt");
await p.getByRole("button", { name: "อัปโหลด" }).click();
await p.waitForTimeout(4000);
log((await p.getByText(/ใช้ไม่ได้ — รองรับเฉพาะ/).count()) > 0, "ปฏิเสธไฟล์ที่ไม่ใช่ภาพ");

// ---------- ④ ลบสคริปต์ที่ฝังใน SVG ----------
await p.locator('select[name="type"]').selectOption("logo");
await p.locator('input[type="file"]').setInputFiles("/tmp/uat-logo-evil.svg");
await p.getByRole("button", { name: "อัปโหลด" }).click();
await p.waitForTimeout(5000);
log(
  (await p.getByText(/พบสคริปต์ฝังอยู่ในไฟล์ SVG และถูกลบออกแล้ว/).count()) > 0,
  "ตรวจพบและลบสคริปต์ที่ฝังมาในไฟล์ SVG",
);

const svgSrc = await p
  .locator("figure img")
  .filter({ hasNot: p.locator("[src$='.webp']") })
  .first()
  .getAttribute("src")
  .catch(() => null);

if (svgSrc?.endsWith(".svg")) {
  const svgBody = await (await p.request.get(`${BASE}${svgSrc}`)).text();
  log(!svgBody.includes("<script"), "ไฟล์ SVG ที่เก็บไว้ไม่มีแท็ก script เหลืออยู่");
  log(!/onload=/i.test(svgBody), "ไฟล์ SVG ที่เก็บไว้ไม่มี event handler เหลืออยู่");
} else {
  log(false, "หาไฟล์ SVG ที่อัปโหลดไม่พบ");
}

// ---------- ⑤ บันทึกคำอธิบายภาพ ----------
console.log("\n④ คำอธิบายภาพ");
await p.getByRole("button", { name: "แก้ไขคำอธิบาย" }).first().click();
await p.waitForTimeout(800);
await p.locator('input[name="altTextTh"]').fill("โปสเตอร์งาน TNN Event 2026");
await p.getByRole("button", { name: "บันทึก", exact: true }).click();
await p.waitForTimeout(3000);
log((await p.getByText("บันทึกข้อมูลภาพเรียบร้อย").count()) > 0, "บันทึกคำอธิบายภาพสำเร็จ");
log(
  (await p.getByText("คำอธิบายภาพ: โปสเตอร์งาน TNN Event 2026").count()) > 0,
  "คำอธิบายภาพแสดงบนการ์ดหลังบันทึก",
);

console.log("\n" + (errs.length ? `⚠️ พบข้อผิดพลาด:\n${errs.slice(0, 6).join("\n")}` : "✅ ไม่มีข้อผิดพลาดในเบราว์เซอร์"));
console.log(fail === 0 ? "\n✅ ผ่านทั้งหมด" : `\n❌ ไม่ผ่าน ${fail} ข้อ`);

await b.close();
process.exit(fail === 0 && errs.length === 0 ? 0 : 1);
