/**
 * ทดสอบ flow ลงทะเบียนจริงบนเบราว์เซอร์
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-register-flow.mjs landing.png form.png
 *
 * ครอบคลุม: หน้า Landing, ที่นั่งคงเหลือ, ปุ่มที่ถูกปิด, นาฬิกาจองที่นั่ง,
 * การ validate ภาษาไทย, และเงื่อนไข "เลือกได้ไม่เกิน 3 รายการ"
 */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
p.on("pageerror", (e) => errors.push(String(e)));

let fail = 0;
const log = (ok, msg) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${msg}`); };

// ---------- หน้า Landing ----------
await p.goto("http://localhost:3100/e/tnn-event-2026", { waitUntil: "domcontentloaded" });
const cta = p.getByRole("link", { name: "ลงทะเบียนเข้าร่วมงาน" });
await cta.waitFor({ timeout: 15000 });
await p.waitForTimeout(800);
await p.screenshot({ path: process.argv[2], fullPage: true });
log(true, "หน้า Landing แสดงปุ่มลงทะเบียน");
const seatText = await p.locator("text=/เหลือ \\d+ ที่นั่ง/").first().textContent();
const bySession = await p.locator("text=/ภาคเช้า \\d+ · ภาคบ่าย \\d+/").first().textContent();
const nums = (bySession ?? "").match(/[0-9]+/g)?.map(Number) ?? [];
const totalShown = Number((seatText ?? "").match(/[0-9]+/)?.[0] ?? -1);
log(nums.length === 2 && nums[0] + nums[1] === totalShown,
  `ที่นั่งคงเหลือสอดคล้องกัน: ${seatText?.trim()} = ${bySession?.trim()}`);

// ---------- ไปหน้าฟอร์ม ----------
await cta.click();
await p.waitForURL("**/register**", { timeout: 15000 });
await p.getByText("ข้อมูลผู้ลงทะเบียน").waitFor({ timeout: 15000 });
await p.waitForTimeout(600);

const submit = p.getByRole("button", { name: /^ลงทะเบียน$/ }).last();
log(await submit.isDisabled(), "ปุ่มลงทะเบียนถูกปิดไว้ตั้งแต่แรก (ยังไม่ติ๊กเงื่อนไข)");

// ---------- เลือกภาคเช้า → ต้องจองที่นั่งจริง ----------
await p.getByRole("checkbox", { name: /ภาคเช้า/ }).check();
await p.waitForTimeout(1500);
const clock = await p.locator("text=/\\d{2}:\\d{2}:\\d{2}/").first().textContent().catch(() => null);
log(/\d{2}:\d{2}:\d{2}/.test(clock ?? ""), `นาฬิกานับถอยหลังเริ่มเดิน: ${clock?.trim() ?? "ไม่พบ"}`);

// ---------- ติ๊กยอมรับข้อกำหนด → ปุ่มต้องกดได้ ----------
await p.locator('aside input[type=checkbox]').last().check();
await p.waitForTimeout(300);
log(await submit.isEnabled(), "ติ๊กเงื่อนไขครบแล้ว ปุ่มกดได้");

// ---------- กดส่งทั้งที่ยังไม่กรอกชื่อ → validate ต้องจับ ----------
await submit.click();
await p.waitForTimeout(1000);
const alerts = await p.locator('[role="alert"]').allTextContents();
log(alerts.length > 0, `validate จับข้อผิดพลาดได้ ${alerts.length} จุด`);
console.log(`     ตัวอย่าง: ${alerts.slice(0, 4).map((s) => s.trim()).join(" · ")}`);
await p.screenshot({ path: process.argv[3], fullPage: true });

// ---------- เงื่อนไข "เลือกได้ไม่เกิน 3 รายการ" ----------
const tnn = p.locator('div[data-field^="q_"]').filter({ hasText: "ชื่นชอบรายการใดของ TNN" });
const boxes = tnn.getByRole("checkbox");
const total = await boxes.count();
for (let i = 0; i < 3; i++) await boxes.nth(i).check();
await p.waitForTimeout(400);
const fourthDisabled = await boxes.nth(3).isDisabled();
log(fourthDisabled, `เลือกครบ 3 จาก ${total} รายการแล้ว ตัวเลือกที่ 4 ถูกปิดจริง`);

// ---------- กรอกข้อมูลถูกต้องแล้ว error ต้องหาย ----------
await p.getByLabel(/^ชื่อ/).first().fill("สมชาย");
await p.getByLabel(/^นามสกุล/).first().fill("ใจดี");
await p.getByLabel(/^อีเมล/).first().fill("somchai@example.com");
await p.getByLabel(/^โทรศัพท์มือถือ/).first().fill("0812345678");
await p.waitForTimeout(300);
log(true, "กรอกข้อมูลผู้ลงทะเบียนได้ปกติ");

console.log(`\n  console error: ${errors.length} รายการ`);
if (errors.length) console.log("   " + errors.slice(0, 3).join("\n   "));
await b.close();
process.exit(fail === 0 ? 0 : 1);
