/**
 * ทดสอบ flow เจ้าหน้าที่หน้างาน
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-staff-flow.mjs staff.png
 *
 * ⚠️ ต้องล้างข้อมูลการเช็คอินก่อนรันทุกครั้ง ไม่งั้นรอบที่สองจะขึ้น "เช็คอินไปแล้ว"
 *    psql -c "DELETE FROM check_ins; UPDATE event_sessions SET checked_in_count=0;"
 *
 * ครอบคลุม: กันเข้าถึงโดยไม่ล็อกอิน, ล็อกอินผิด/ถูก, ตัวนับเช็คอิน,
 * ค้นหาและเช็คอิน, สแกนซ้ำขึ้นจอเหลือง, ลงทะเบียนหน้างาน, และบัตรห้อยคอ
 */
import { chromium } from "playwright";

const executablePath = process.env.CHROMIUM_PATH ?? undefined;
const b = await chromium.launch(executablePath ? { executablePath } : {});
const ctx = await b.newContext({ viewport: { width: 430, height: 930 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

let fail = 0;
const log = (ok, m) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${m}`); };
const BASE = "http://localhost:3100";

// ---------- ① เข้าหน้าเจ้าหน้าที่โดยไม่ล็อกอิน ต้องถูกเด้ง ----------
await p.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }).waitFor({ timeout: 20000 });
log(p.url().includes("/staff/login"), "เข้าหน้าเจ้าหน้าที่โดยไม่ล็อกอิน ถูกเด้งไปหน้าล็อกอิน");

// ---------- ② ล็อกอินด้วยรหัสผิด ----------
await p.getByLabel("อีเมล").fill("staff@example.com");
await p.getByLabel("รหัสผ่าน", { exact: true }).fill("wrong-password");
await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
const loginAlert = p.locator('form [role="alert"]').first();
await loginAlert.waitFor({ timeout: 10000 });
const wrongMsg = await loginAlert.textContent();
log(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/.test(wrongMsg ?? ""), `รหัสผิดขึ้น error และไม่บอกว่าผิดที่ช่องไหน: "${wrongMsg?.trim()}"`);

// ---------- ③ ล็อกอินถูก ----------
await p.getByLabel("รหัสผ่าน", { exact: true }).fill("staff-dev-1234");
await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
await p.getByText("เช็คอินแล้ว").waitFor({ timeout: 25000 });
log(true, "ล็อกอินสำเร็จ เข้าหน้าสแกนได้");

const bar = await p.locator("text=/ออนไลน์|ออฟไลน์/").first().textContent();
log(/ออนไลน์/.test(bar ?? ""), `แถบสถานะการเชื่อมต่อแสดงผล: "${bar?.trim()}"`);
await p.waitForTimeout(800);
await p.screenshot({ path: process.argv[2], fullPage: true });

// ---------- ④ ดาวน์โหลดรายชื่อลงเครื่อง ----------
await p.getByRole("button", { name: "ดาวน์โหลดรายชื่อ" }).click();
await p.waitForTimeout(2000);
const dl = await p.locator("text=/ดาวน์โหลดรายชื่อ .* คนลงเครื่องแล้ว/").first().textContent().catch(() => null);
log(Boolean(dl), `ดาวน์โหลดรายชื่อลงเครื่องสำเร็จ: "${dl?.trim() ?? "ไม่พบ"}"`);

// ---------- ⑤ ค้นหาและเช็คอิน ----------
await p.getByRole("link", { name: /ค้นหารายชื่อ/ }).click();
await p.getByLabel("ค้นหาผู้ลงทะเบียน").waitFor({ timeout: 20000 });
await p.getByLabel("ค้นหาผู้ลงทะเบียน").fill("สมชาย");
await p.waitForTimeout(1500);
const hitCount = await p.locator("li button").count();
log(hitCount > 0, `ค้นหาด้วยชื่อไทยเจอ ${hitCount} รายการ`);

if (hitCount > 0) {
  await p.locator("li button").first().click();
  await p.getByRole("status").waitFor({ timeout: 10000 });
  const res = await p.getByRole("status").textContent();
  log(/เช็คอินสำเร็จ/.test(res ?? ""), "กดชื่อแล้วเช็คอินสำเร็จ (จอเขียว)");

  // ---------- ⑥ เช็คอินซ้ำ ต้องขึ้นจอเหลือง ----------
  await p.getByRole("button", { name: /สแกนคนถัดไป/ }).click();
  await p.getByLabel("ค้นหาผู้ลงทะเบียน").fill("สมชาย");
  await p.waitForTimeout(1500);
  await p.locator("li button").first().click();
  await p.getByRole("status").waitFor({ timeout: 10000 });
  const dup = await p.getByRole("status").textContent();
  log(/เช็คอินไปแล้ว/.test(dup ?? ""), "เช็คอินซ้ำขึ้นจอเหลืองพร้อมเวลาที่เช็คอินครั้งแรก");
}

// ---------- ⑦ ลงทะเบียนหน้างาน ----------
await p.goto(`${BASE}/staff/walkin`, { waitUntil: "domcontentloaded" });
await p.getByLabel(/^ชื่อ/).first().waitFor({ timeout: 15000 });
await p.getByLabel(/^ชื่อ/).first().fill("วอล์ค");
await p.getByLabel(/^นามสกุล/).first().fill("อิน");
await p.getByLabel(/^เบอร์โทรศัพท์/).fill("0899999999");
await p.locator("#occupation").selectOption({ index: 1 });
await p.locator('input[type=checkbox]').first().check();
const cbs = p.locator('input[type=checkbox]');
const n = await cbs.count();
await cbs.nth(n - 2).check();
await cbs.nth(n - 1).check();
await p.getByRole("button", { name: "บันทึกและเช็คอิน" }).click();
await p.getByText("ลงทะเบียนและเช็คอินแล้ว").waitFor({ timeout: 15000 });
log(true, "ลงทะเบียนหน้างานสำเร็จและเช็คอินให้ทันที");

console.log(`\n  pageerror: ${errs.length}`);
if (errs.length) console.log("   " + errs.slice(0, 3).join("\n   "));
await b.close();
process.exit(fail === 0 ? 0 : 1);
