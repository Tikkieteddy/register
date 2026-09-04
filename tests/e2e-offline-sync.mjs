/**
 * ทดสอบการทำงานตอนเน็ตหลุด — จุดเสี่ยงที่สุดของทั้งระบบ
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-offline-sync.mjs
 *
 * ⚠️ ต้องล้างข้อมูลการเช็คอินก่อนรันทุกครั้ง
 *
 * จำลองสถานการณ์จริง: Wi-Fi ในงานล่มระหว่างเช็คอิน
 *   ① ดาวน์โหลดรายชื่อลงเครื่องตอนยังออนไลน์
 *   ② ตัดเน็ต แล้วเช็คอินต่อ — ต้องยังทำงานได้และเก็บเข้าคิว
 *   ③ ต่อเน็ตกลับ — ต้อง sync ขึ้นเซิร์ฟเวอร์อัตโนมัติโดยไม่ต้องกดอะไร
 */
import { chromium } from "playwright";

const executablePath = process.env.CHROMIUM_PATH ?? undefined;
const b = await chromium.launch(executablePath ? { executablePath } : {});
const ctx = await b.newContext({ viewport: { width: 430, height: 930 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));

let fail = 0;
const log = (ok, m) => { if (!ok) fail++; console.log(`  ${ok ? "✅" : "❌"} ${m}`); };
const BASE = "http://localhost:3100";

// ---------- ล็อกอินและดาวน์โหลดรายชื่อขณะออนไลน์ ----------
await p.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }).waitFor({ timeout: 20000 });
await p.getByLabel("อีเมล").fill("staff@example.com");
await p.getByLabel("รหัสผ่าน", { exact: true }).fill("staff-dev-1234");
await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
await p.getByText("เช็คอินแล้ว").waitFor({ timeout: 25000 });

await p.getByRole("button", { name: "ดาวน์โหลดรายชื่อ" }).click();
await p.locator("text=/ดาวน์โหลดรายชื่อ .* คนลงเครื่องแล้ว/").first().waitFor({ timeout: 20000 });
log(true, "ดาวน์โหลดรายชื่อลงเครื่องตอนออนไลน์");

// ---------- ตัดเน็ต ----------
await ctx.setOffline(true);
await p.evaluate(() => window.dispatchEvent(new Event("offline")));
await p.waitForTimeout(1200);
const offlineBar = await p.locator("text=/ออฟไลน์/").first().textContent().catch(() => null);
log(Boolean(offlineBar), `แถบสถานะเปลี่ยนเป็นออฟไลน์: "${offlineBar?.trim() ?? "ไม่พบ"}"`);

// ---------- เช็คอินขณะออฟไลน์ผ่านหน้าค้นหา ----------
await p.getByRole("link", { name: /ค้นหารายชื่อ/ }).click();
await p.getByLabel("ค้นหาผู้ลงทะเบียน").waitFor({ timeout: 20000 });
await p.getByLabel("ค้นหาผู้ลงทะเบียน").fill("สมชาย");
await p.waitForTimeout(1500);
const offlineHits = await p.locator("li button").count();
log(offlineHits > 0, `ค้นหาจากข้อมูลในเครื่องได้ขณะออฟไลน์ (${offlineHits} รายการ)`);

if (offlineHits > 0) {
  await p.locator("li button").first().click();
  await p.getByRole("status").first().waitFor({ timeout: 15000 });
  const res = await p.getByRole("status").first().textContent();
  log(/เช็คอินสำเร็จ/.test(res ?? ""), "เช็คอินขณะออฟไลน์สำเร็จ (จอเขียว)");
  log(
    /บันทึกในเครื่องแล้ว/.test(res ?? ""),
    "แจ้งผู้ใช้ชัดเจนว่าบันทึกในเครื่อง รอส่งขึ้นระบบ",
  );

  await p.waitForTimeout(1000);
  const pendingBar = await p.locator("text=/บันทึกในเครื่อง [0-9]+ รายการ/").first().textContent().catch(() => null);
  log(Boolean(pendingBar), `แถบสถานะนับรายการค้าง: "${pendingBar?.trim() ?? "ไม่พบ"}"`);
}

// ---------- ต่อเน็ตกลับ ต้อง sync อัตโนมัติ ----------
await ctx.setOffline(false);
await p.evaluate(() => window.dispatchEvent(new Event("online")));
await p.waitForTimeout(4000);
const backOnline = await p.locator("text=/ออนไลน์/").first().textContent().catch(() => null);
log(Boolean(backOnline), `เน็ตกลับมา แถบสถานะกลับเป็นออนไลน์: "${backOnline?.trim() ?? "ไม่พบ"}"`);

const stillPending = await p.locator("text=/บันทึกในเครื่อง [0-9]+ รายการ/").count();
log(stillPending === 0, "คิวที่ค้างถูกส่งขึ้นเซิร์ฟเวอร์จนหมดโดยไม่ต้องกดอะไร");

console.log(`\n  pageerror: ${errs.length}`);
if (errs.length) console.log("   " + errs.slice(0, 3).join("\n   "));
await b.close();
process.exit(fail === 0 ? 0 : 1);
