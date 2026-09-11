/**
 * ทดสอบหลังบ้านผู้ดูแล (เฟส 5)
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-admin-flow.mjs
 *
 * ⚠️ ต้องมีข้อมูลตัวอย่างในระบบก่อน:
 *      npm run db:reset-demo && npm run db:seed && npm run db:demo
 *
 * ครอบคลุม: กันเข้าถึงโดยไม่ใช่ผู้ดูแล · Dashboard 11 กราฟ · ค้นหาและกรองรายชื่อ ·
 * Export xlsx และ CSV · แก้ไขและยกเลิกการลงทะเบียนพร้อมคืนที่นั่ง · เพิ่มด้วยมือ ·
 * สร้างลิงก์ติดตามผลและดาวน์โหลด QR · ตั้งค่าที่นั่ง · บันทึก audit log
 */
import { launchBrowser } from "./browser.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
p.on("response", (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`); });

let fail = 0;
const log = (ok, m) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${m}`); };

async function login(email, password) {
  // ล้าง session เดิมก่อนเสมอ ไม่งั้นหน้าล็อกอินจะเด้งออกทันทีเมื่อยังล็อกอินค้างอยู่
  await ctx.clearCookies();
  await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await p.getByRole("heading", { name: "เข้าสู่ระบบ", exact: true }).waitFor({ timeout: 30000 });
  await p.waitForTimeout(1200);
  await p.getByLabel("อีเมล").fill(email);
  await p.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  /**
   * ⚠️ ต้องรอด้วย locator ห้ามใช้ waitForFunction ตรงนี้
   *
   *    การล็อกอินสำเร็จจะสั่งโหลดหน้าใหม่ทั้งหน้า ซึ่งทำลาย JavaScript context เดิม
   *    waitForFunction ที่รันอยู่บน context นั้นจะพังกลางคัน แล้วเทสต์ก็วิ่งต่อ
   *    ทั้งที่หน้ายังโหลดไม่เสร็จ พอสั่งเปลี่ยนหน้าซ้อนเข้าไปก็ชนกันแล้วล้มแบบสับสน
   *
   *    locator.waitFor ของ Playwright รู้จักการโหลดหน้าใหม่ จึงรอได้ถูกต้อง
   */
  await p
    .getByRole("heading", { name: "เลือกส่วนที่ต้องการใช้งาน" })
    .waitFor({ timeout: 30000 });
}

// ---------- ① เจ้าหน้าที่ธรรมดาต้องเข้าหลังบ้านไม่ได้ ----------
console.log("\n① สิทธิ์การเข้าถึง");
await login("staff@example.com", "staff-dev-1234");
await p.goto(`${BASE}/admin-cms`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
log(
  p.url().includes("/admin?denied=cms"),
  "บัญชีเจ้าหน้าที่เข้าระบบจัดการงานไม่ได้ ถูกพากลับหน้าเลือกพร้อมคำอธิบาย",
);

// ---------- ② ผู้ดูแลเข้าได้ และ Dashboard แสดงครบ ----------
console.log("\n② Dashboard");
await login("admin@example.com", "admin-dev-1234");
await p.goto(`${BASE}/admin-cms`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 45000 });

const chartCount = await p.locator("h3").filter({ hasText: /.+/ }).count();
log(chartCount >= 11, `แสดงกราฟครบ 11 ชุด (พบหัวข้อกราฟ ${chartCount} ชุด)`);

const totalText = await p.getByText("ลงทะเบียนทั้งหมด").locator("..").textContent();
const totalNumber = Number((totalText ?? "").replace(/[^0-9]/g, ""));
log(totalNumber > 0, `ตัวเลขสรุปมีข้อมูลจริง (ลงทะเบียนทั้งหมด ${totalNumber} คน)`);

// ---------- ③ ค้นหาและกรองรายชื่อ ----------
console.log("\n③ รายชื่อผู้ลงทะเบียน");
await p.goto(`${BASE}/admin-cms/registrations`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "รายชื่อผู้ลงทะเบียน" }).waitFor({ timeout: 45000 });
const allRows = await p.locator("table tbody tr").count();
log(allRows > 1, `แสดงรายชื่อได้ ${allRows} แถว`);

const firstName = await p.locator("table tbody tr td a").first().textContent();
const searchTerm = (firstName ?? "").trim().split(" ")[0];
await p.waitForTimeout(800);
await p.getByPlaceholder(/ค้นหา/).fill(searchTerm);
await p.getByRole("button", { name: "ค้นหา", exact: true }).click();
await p.waitForTimeout(2000);
const searchRows = await p.locator("table tbody tr").count();
log(searchRows > 0 && searchRows <= allRows, `ค้นหาด้วยชื่อ "${searchTerm}" ได้ ${searchRows} แถว`);

await p.goto(`${BASE}/admin-cms/registrations?checkin=in`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "รายชื่อผู้ลงทะเบียน" }).waitFor({ timeout: 45000 });
const checkedRows = await p.locator("table tbody tr").count();
const badges = await p.getByText("เช็คอินแล้ว", { exact: true }).count();
log(checkedRows > 0 && badges >= checkedRows, `กรอง "เช็คอินแล้ว" ได้ ${checkedRows} แถว และทุกแถวขึ้นป้ายถูกต้อง`);

// ---------- ④ Export ----------
console.log("\n④ ส่งออกข้อมูล");
await p.goto(`${BASE}/admin-cms/registrations`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "รายชื่อผู้ลงทะเบียน" }).waitFor({ timeout: 45000 });

for (const [label, ext] of [["Excel (.xlsx)", "xlsx"], ["CSV", "csv"]]) {
  const [download] = await Promise.all([
    p.waitForEvent("download", { timeout: 30000 }),
    p.getByRole("link", { name: label }).click(),
  ]);
  const path = `/tmp/export-test.${ext}`;
  await download.saveAs(path);
  const { statSync } = await import("node:fs");
  const size = statSync(path).size;
  log(size > 1000, `ดาวน์โหลด ${label} สำเร็จ ขนาด ${size} ไบต์`);
}

const { readFileSync } = await import("node:fs");
const csv = readFileSync("/tmp/export-test.csv");
log(csv[0] === 0xef && csv[1] === 0xbb && csv[2] === 0xbf, "ไฟล์ CSV มี BOM ครบ (เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน)");
log(csv.toString("utf8").includes("รหัสลงทะเบียน"), "หัวตาราง CSV เป็นภาษาไทยอ่านออก");

// ---------- ⑤ เพิ่มผู้ลงทะเบียนด้วยมือ ----------
console.log("\n⑤ เพิ่มด้วยมือ");
const stamp = Date.now();
await p.goto(`${BASE}/admin-cms/registrations/new`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "เพิ่มผู้ลงทะเบียนด้วยมือ" }).waitFor({ timeout: 45000 });
await p.waitForTimeout(1200);
await p.getByRole("textbox", { name: "ชื่อ", exact: true }).fill("วีไอพี");
await p.getByRole("textbox", { name: "นามสกุล" }).fill("ทดสอบ");
await p.getByRole("textbox", { name: "อีเมล", exact: true }).fill(`vip.${stamp}@example.com`);
await p.getByRole("textbox", { name: "โทรศัพท์มือถือ" }).fill("0891234567");
// ติ๊กช่วงเวลาแรก (ช่องติ๊กแรกของฟอร์มคือช่วงเวลา ไม่ใช่ตัวเลือกอื่น)
await p.locator('fieldset input[type="checkbox"]').first().check();
await p.getByRole("button", { name: "บันทึกและออกตั๋ว" }).click();
await p.waitForTimeout(2500);
const consentBlocked = await p.getByText("ต้องยืนยันว่าได้แจ้งข้อความ PDPA").count();
log(consentBlocked > 0, "บันทึกไม่ได้ถ้ายังไม่ยืนยันว่าแจ้ง PDPA แล้ว");

await p.getByText("ยืนยันว่าได้แจ้งข้อความความยินยอมตาม PDPA").click();
await p.getByRole("button", { name: "บันทึกและออกตั๋ว" }).click();
await p.waitForURL(/\/admin-cms\/registrations\/[0-9a-f-]{36}/, { timeout: 30000 }).catch(() => {});
const onDetail = /\/admin-cms\/registrations\/[0-9a-f-]{36}/.test(p.url());
log(onDetail, "เพิ่มผู้ลงทะเบียนด้วยมือสำเร็จ และเข้าหน้ารายละเอียดทันที");

const detailUrl = p.url();

// ---------- ⑥ แก้ไขและยกเลิก ----------
console.log("\n⑥ แก้ไขและยกเลิกการลงทะเบียน");
await p.getByRole("heading", { name: /วีไอพี/ }).waitFor({ timeout: 30000 });
await p.waitForTimeout(1200);
await p.getByRole("textbox", { name: "นามสกุล" }).fill("ทดสอบแก้ไข");
await p.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
await p.waitForTimeout(2500);
log((await p.getByText("บันทึกการแก้ไขเรียบร้อย").count()) > 0, "แก้ไขชื่อผู้ลงทะเบียนสำเร็จ");

// อ่านที่นั่งคงเหลือก่อนยกเลิก
await p.goto(`${BASE}/admin-cms/settings?tab=quota`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "ตั้งค่างาน" }).waitFor({ timeout: 45000 });
const beforeText = await p.getByText(/รวมทั้งงาน .* คงเหลือ/).textContent();
const beforeRemaining = Number((beforeText ?? "").match(/คงเหลือ\s*([0-9]+)/)?.[1] ?? "0");

p.once("dialog", () => {});
await p.goto(detailUrl, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
// prompt() ของเบราว์เซอร์ต้องตอบก่อน ไม่งั้นโค้ดจะค้าง
await p.evaluate(() => { window.prompt = () => "ทดสอบยกเลิก"; });
await p.getByRole("button", { name: "ยกเลิกการลงทะเบียน" }).click();
await p.waitForTimeout(3000);
log((await p.getByText(/ยกเลิกแล้ว 1 รายการ/).count()) > 0, "ยกเลิกการลงทะเบียนสำเร็จ");

await p.goto(`${BASE}/admin-cms/settings?tab=quota`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "ตั้งค่างาน" }).waitFor({ timeout: 45000 });
const afterText = await p.getByText(/รวมทั้งงาน .* คงเหลือ/).textContent();
const afterRemaining = Number((afterText ?? "").match(/คงเหลือ\s*([0-9]+)/)?.[1] ?? "0");
log(afterRemaining === beforeRemaining + 1, `ยกเลิกแล้วคืนที่นั่งเข้าระบบทันที (${beforeRemaining} → ${afterRemaining})`);

// ---------- ⑦ กันลดโควตาต่ำกว่าจำนวนที่จองไปแล้ว ----------
console.log("\n⑦ ป้องกันการตั้งค่าที่นั่งผิดพลาด");
await p.waitForTimeout(1000);
const quotaInput = p.getByRole("spinbutton", { name: "จำนวนที่นั่ง" }).first();
await quotaInput.fill("1");
await p.getByRole("button", { name: "บันทึกการตั้งค่าที่นั่ง" }).click();
await p.waitForTimeout(2500);
log((await p.getByText(/เพราะมีคนจองไปแล้ว/).count()) > 0, "ลดที่นั่งต่ำกว่าจำนวนที่จองไปแล้วไม่ได้ พร้อมบอกเหตุผล");

// ---------- ⑧ ลิงก์ติดตามผล ----------
console.log("\n⑧ ลิงก์ติดตามผล");
await p.goto(`${BASE}/admin-cms/links`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "ลิงก์ติดตามผล" }).waitFor({ timeout: 45000 });
await p.waitForTimeout(1200);
await p.getByRole("button", { name: "สร้างลิงก์ใหม่" }).click();
const code = `t${String(stamp).slice(-6)}`;
await p.getByPlaceholder("fb01").fill(code);
await p.getByPlaceholder("โพสต์ Facebook วันที่ 1").fill("ลิงก์ทดสอบอัตโนมัติ");
await p.getByRole("button", { name: "บันทึก", exact: true }).click();
await p.waitForTimeout(2500);
log((await p.getByText(new RegExp(`สร้างลิงก์ /r/${code}`)).count()) > 0, `สร้างลิงก์ /r/${code} สำเร็จ`);

const [qrDownload] = await Promise.all([
  p.waitForEvent("download", { timeout: 30000 }),
  p.getByRole("link", { name: "QR PNG" }).first().click(),
]);
await qrDownload.saveAs("/tmp/link-qr.png");
const { statSync } = await import("node:fs");
log(statSync("/tmp/link-qr.png").size > 1000, "ดาวน์โหลด QR ของลิงก์เป็นไฟล์ PNG ได้");

const redirect = await p.goto(`${BASE}/r/${code}`, { waitUntil: "domcontentloaded" });
log((redirect?.url() ?? "").includes(`ref=${code}`), "ลิงก์ที่สร้างใหม่ใช้งานได้จริงและส่งค่า ref ต่อ");

// ---------- ⑨ audit log ----------
console.log("\n⑨ บันทึกการใช้งาน");
await p.goto(`${BASE}/admin-cms/audit`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "บันทึกการใช้งาน" }).waitFor({ timeout: 45000 });
for (const action of ["ส่งออกข้อมูล", "ยกเลิกการลงทะเบียน", "สร้างลิงก์ติดตามผล", "เปิดดูรายชื่อ"]) {
  log((await p.getByText(action, { exact: true }).count()) > 0, `audit log บันทึก "${action}" ไว้แล้ว`);
}

console.log("\n" + (errs.length ? `⚠️ พบข้อผิดพลาดในเบราว์เซอร์:\n${errs.slice(0, 8).join("\n")}` : "✅ ไม่มีข้อผิดพลาดในเบราว์เซอร์"));
console.log(fail === 0 ? "\n✅ ผ่านทั้งหมด" : `\n❌ ไม่ผ่าน ${fail} ข้อ`);

await b.close();
process.exit(fail === 0 && errs.length === 0 ? 0 : 1);
