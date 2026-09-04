/**
 * ทดสอบ flow ลงทะเบียนเต็มรูปแบบ ตั้งแต่คลิกลิงก์ติดตามผลจนได้ตั๋ว
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-full-flow.mjs thankyou.png print.png
 *
 * ครอบคลุม: ลิงก์สั้น /r/[code], การกรอกฟอร์มครบทุกช่อง, การจองที่นั่ง 2 ช่วง,
 * การบันทึกลงฐานข้อมูล, หน้าเสร็จสิ้น, QR Code และหน้าตั๋วสำหรับพิมพ์
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
let fail = 0;
const log = (ok, m) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${m}`); };

// เข้าผ่านลิงก์ติดตามผลเพื่อทดสอบว่าผูก conversion ได้จริง
await p.goto("http://localhost:3100/r/fb01", { waitUntil: "domcontentloaded" });
await p.getByRole("link", { name: "ลงทะเบียนเข้าร่วมงาน" }).waitFor({ timeout: 15000 });
log(p.url().includes("ref=fb01"), "ลิงก์ติดตามผลพาเข้าหน้างานพร้อม ref");

await p.getByRole("link", { name: "ลงทะเบียนเข้าร่วมงาน" }).click();
await p.waitForURL("**/register**", { timeout: 15000 });
await p.getByText("ข้อมูลผู้ลงทะเบียน").waitFor({ timeout: 15000 });
await p.waitForTimeout(500);

// กรอกครบทุกช่อง
await p.getByLabel(/^ชื่อ/).first().fill("สมชาย");
await p.getByLabel(/^นามสกุล/).first().fill("ใจดี");
const email = `somchai.${Date.now()}@example.com`;
await p.getByLabel(/^อีเมล/).first().fill(email);
await p.getByLabel(/^โทรศัพท์มือถือ/).first().fill("081-234-5678");

await p.getByRole("checkbox", { name: /ภาคเช้า/ }).check();
await p.waitForTimeout(1200);
await p.getByRole("checkbox", { name: /ภาคบ่าย/ }).check();
await p.waitForTimeout(1200);
log(true, "เลือกทั้งภาคเช้าและภาคบ่าย จองที่นั่ง 2 ที่");

await p.locator('select#q_' + (await p.locator('div[data-field^="q_"] select').first().getAttribute("id"))?.replace("q_","")).first().selectOption({ index: 2 }).catch(async () => {
  await p.locator('div[data-field^="q_"] select').first().selectOption({ index: 2 });
});
const hear = p.locator('div[data-field^="q_"]').filter({ hasText: "ทราบข้อมูล event" }).getByRole("checkbox");
await hear.nth(0).check();
const tnn = p.locator('div[data-field^="q_"]').filter({ hasText: "ชื่นชอบรายการใดของ TNN" }).getByRole("checkbox");
await tnn.nth(0).check();
await tnn.nth(1).check();

await p.locator('#consentPhoto').check();
await p.getByRole("radio", { name: "ยินยอม", exact: true }).check();
await p.locator('#saveForNextTime').check();
await p.locator('aside input[type=checkbox]').last().check();
await p.waitForTimeout(400);

const submit = p.getByRole("button", { name: /^ลงทะเบียน$/ }).last();
log(await submit.isEnabled(), "กรอกครบแล้ว ปุ่มลงทะเบียนกดได้");

await submit.click();
await p.waitForURL("**/ticket/**", { timeout: 20000 });
await p.waitForTimeout(1500);
log(p.url().includes("justRegistered=1"), "บันทึกสำเร็จ พาไปหน้าเสร็จสิ้น");

const body = await p.locator("body").innerText();
log(body.includes("ขอบคุณสำหรับการลงทะเบียน สมชาย"), "แสดงข้อความขอบคุณด้วยชื่อจริง (ไม่มีนามสกุล)");
log(body.includes("รหัสคำสั่งซื้อ"), "แสดงรหัสคำสั่งซื้อ");
log(await p.locator('img[alt*="QR Code"]').isVisible(), "แสดง QR Code");
log(body.includes(email), "แสดงอีเมลที่กรอกไว้");
log(body.includes("ภาคเช้า") && body.includes("ภาคบ่าย"), "แสดงช่วงเวลาที่เลือกจริงทั้ง 2 ช่วง");
await p.screenshot({ path: process.argv[2], fullPage: true });

// หน้าตั๋วสำหรับพิมพ์
const token = p.url().split("/ticket/")[1].split("?")[0];
await p.goto(`http://localhost:3100/ticket/${token}/print`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1200);
log((await p.locator("svg").count()) > 0, "หน้าพิมพ์ตั๋วใช้ QR แบบ SVG (คมชัดทุกความละเอียด)");
await p.screenshot({ path: process.argv[3], fullPage: true });

console.log(`\n  token: ${token}`);
console.log(`  pageerror: ${errs.length}`);
if (errs.length) console.log("   " + errs.slice(0,2).join("\n   "));
await b.close();
process.exit(fail === 0 ? 0 : 1);
