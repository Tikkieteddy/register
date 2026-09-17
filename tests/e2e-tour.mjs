/**
 * ทดสอบคำแนะนำการใช้งานสำหรับคนเข้าครั้งแรก
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-tour.mjs
 *
 * ครอบคลุม: เปิดเองครั้งแรก · ชี้ปุ่มถูกตัว · เดินหน้า-ถอยหลัง · ข้ามได้ ·
 * ดูจบแล้วไม่ขึ้นซ้ำ · กดดูใหม่ได้ · ครบทั้ง 3 ส่วน (เว็บหลัก · หลังบ้าน · หน้าสแกน)
 */
import { launchBrowser } from "./browser.mjs";
import { connect } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

/**
 * ล้างตัวนับจำนวนครั้งก่อนเริ่ม
 * เทสต์นี้ล็อกอินหลายรอบ ถ้ารันต่อจากเทสต์อื่นที่ล็อกอินมาแล้ว
 * จะชนเพดานแล้วล็อกอินไม่ผ่าน ซึ่งไม่ใช่ความผิดของระบบ
 */
const sql = connect();
await sql`delete from rate_limits`;
await sql.end({ timeout: 5 });
let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

// เทสต์นี้ทดสอบตัวคำแนะนำเอง จึงต้องไม่ปิดมันทิ้ง
const b = await launchBrowser({ keepTour: true });

async function login(p, email, password) {
  await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.getByLabel("อีเมล").fill(email);
  await p.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await p.getByRole("heading", { name: "เลือกส่วนที่ต้องการใช้งาน" }).waitFor({ timeout: 30000 });
}

try {
  /* ---------- ① เว็บหลัก ---------- */
  console.log("\n① คำแนะนำบนเว็บหลัก");
  let ctx = await b.newContext();
  let p = await ctx.newPage();
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

  const dialog = p.getByRole("dialog", { name: "คำแนะนำการใช้งาน" });
  await dialog.waitFor({ timeout: 15000 }).catch(() => {});
  check("เข้าครั้งแรกคำแนะนำขึ้นเอง", await dialog.count() > 0);
  check("ขึ้นข้อทักทายเป็นข้อแรก",
    (await p.getByRole("heading", { name: /ยินดีต้อนรับ/ }).count()) > 0);
  /**
   * จำนวนข้อไม่ตายตัว — ขึ้นกับว่าเมนูไหนมองเห็นได้จริงบนจอขนาดนั้น
   * เช่นปุ่มเปิดเมนูจะโผล่เฉพาะบนจอเล็ก ส่วนเมนูเต็มแถวโผล่เฉพาะจอใหญ่
   * เทสต์จึงตรวจว่า "มีตัวนับและเลขหน้าสมเหตุสมผล" ไม่ใช่ตรึงตัวเลขไว้
   */
  const counter = await p.locator('[role="dialog"] .tabular-nums').innerText();
  check(`บอกว่าอยู่ข้อที่เท่าไรจากทั้งหมด (${counter})`, /^1\/[0-9]+$/.test(counter.trim()));

  // เดินไปข้อ 2 แล้วดูว่าไฮไลต์ปุ่มจริง
  await p.getByRole("button", { name: "ถัดไป" }).click();
  await p.waitForTimeout(900);
  check("ข้อ 2 ชี้ไปที่รายการงาน",
    (await p.getByRole("heading", { name: "งานที่เปิดรับลงทะเบียน" }).count()) > 0);
  const target = await p.locator('[data-tour="event-list"]').count();
  check("ปุ่มที่จะชี้มีอยู่จริงบนหน้า", target === 1, `พบ ${target} จุด`);

  await p.getByRole("button", { name: "ย้อนกลับ" }).click();
  await p.waitForTimeout(600);
  /* กลับมาข้อแรกต้องได้ตัวนับเดิมเป๊ะ — เทียบกับค่าที่อ่านไว้ตอนต้น ไม่ตรึงเลขไว้ในเทสต์ */
  const backCounter = await p.locator('[role="dialog"] .tabular-nums').innerText();
  check("กดย้อนกลับได้", backCounter.trim() === counter.trim(),
    `คาดว่า ${counter.trim()} แต่ได้ ${backCounter.trim()}`);

  // ข้ามแล้วต้องไม่ขึ้นอีก
  await p.getByRole("button", { name: "ข้ามคำแนะนำ" }).click();
  await p.waitForTimeout(500);
  check("กดข้ามแล้วปิดทันที", (await dialog.count()) === 0);

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  check("ดูจบแล้วเข้าใหม่ไม่ขึ้นซ้ำ", (await dialog.count()) === 0);

  // กดดูใหม่ได้
  await p.getByRole("button", { name: "ดูคำแนะนำการใช้งาน" }).click();
  await p.waitForTimeout(900);
  check("กดปุ่มดูคำแนะนำซ้ำได้", (await dialog.count()) > 0);
  await ctx.close();

  /* ---------- ② หลังบ้าน ---------- */
  console.log("\n② คำแนะนำในระบบจัดการงาน");
  ctx = await b.newContext();
  p = await ctx.newPage();
  await login(p, "admin@example.com", "admin-dev-1234");
  await p.goto(`${BASE}/admin-cms`, { waitUntil: "domcontentloaded" });
  const d2 = p.getByRole("dialog", { name: "คำแนะนำการใช้งาน" });
  await d2.waitFor({ timeout: 15000 }).catch(() => {});
  check("เข้าหลังบ้านครั้งแรกคำแนะนำขึ้นเอง", (await d2.count()) > 0);
  /**
   * จำนวนข้อขึ้นกับว่ามีกี่งานในระบบ
   * ตัวสลับงานจะโผล่ก็ต่อเมื่อมีงานตั้งแต่ 2 งานขึ้นไป ถ้ามีงานเดียว
   * คำแนะนำต้องข้ามข้อนั้นไปเอง ไม่ใช่พูดถึงปุ่มที่ผู้ใช้มองไม่เห็น
   */
  const hasSwitcher = (await p.locator('[data-tour="cms-event-switcher"]').count()) > 0;
  const cmsCounter = await p.locator('[role="dialog"] .tabular-nums').innerText();
  check(`นับข้อได้ถูกต้อง (${cmsCounter.trim()})`, /^1\/1[0-9]$/.test(cmsCounter.trim()),
    hasSwitcher ? "มีตัวสลับงาน" : "มีงานเดียว จึงไม่มีตัวสลับงาน");

  /**
   * เดินดูทุกข้อจนจบ แล้วเก็บหัวข้อไว้ตรวจว่าครอบคลุมเมนูครบ
   * เพราะโจทย์คือ "แนะนำทุกเมนู" ไม่ใช่แค่แนะนำบางอัน
   */
  const titles = [];
  for (let i = 0; i < 25; i++) {
    titles.push(await p.locator('[role="dialog"] h2').innerText());
    const next = p.getByRole("button", { name: "ถัดไป" });
    if ((await next.count()) === 0) break;
    await next.click();
    await p.waitForTimeout(350);
  }
  const joined = titles.join(" | ");

  for (const menu of [
    "งานทั้งหมด",
    "Dashboard",
    "ผู้ลงทะเบียน",
    "จัดการอีเมล",
    "ลิงก์ติดตามผล",
    "ภาพและสื่อ",
    "ตั้งค่างาน",
    "บันทึกการใช้งาน",
  ]) {
    check(`แนะนำเมนู "${menu}"`, joined.includes(menu));
  }
  check("แนะนำส่วนบัญชีผู้ใช้ด้วย", joined.includes("บัญชีของคุณ"));
  check("ไม่พูดถึงตัวสลับงานตอนที่ไม่มีให้เห็น",
    hasSwitcher || !joined.includes("สลับไปดูแลงานอื่น"));
  await ctx.close();

  /* ---------- ③ หน้าสแกน ---------- */
  console.log("\n③ คำแนะนำบนหน้าสแกนหน้างาน");
  ctx = await b.newContext();
  p = await ctx.newPage();
  await login(p, "staff@example.com", "staff-dev-1234");
  await p.getByRole("link", { name: /สแกนเช็คอินหน้างาน/ }).click({ timeout: 20000 });
  await p.getByText("เช็คอินแล้ว").waitFor({ timeout: 25000 });
  const d3 = p.getByRole("dialog", { name: "คำแนะนำการใช้งาน" });
  await d3.waitFor({ timeout: 15000 }).catch(() => {});
  check("เข้าหน้าสแกนครั้งแรกคำแนะนำขึ้นเอง", (await d3.count()) > 0);

  await p.getByRole("button", { name: "ถัดไป" }).click();
  await p.waitForTimeout(900);
  check("เตือนเรื่องดาวน์โหลดรายชื่อก่อนเริ่มงาน",
    (await p.getByRole("heading", { name: /กดปุ่มนี้ก่อนเริ่มงานทุกครั้ง/ }).count()) > 0);
  check("ปุ่มดาวน์โหลดมีอยู่จริง", (await p.locator('[data-tour="scan-download"]').count()) > 0);
  check("แถบสถานะมีอยู่จริง", (await p.locator('[data-tour="scan-status"]').count()) > 0);

  // ข้อสุดท้ายต้องเป็นปุ่ม "เริ่มใช้งาน"
  for (let i = 0; i < 3; i++) {
    const next = p.getByRole("button", { name: "ถัดไป" });
    if ((await next.count()) === 0) break;
    await next.click();
    await p.waitForTimeout(600);
  }
  check("ข้อสุดท้ายเปลี่ยนปุ่มเป็น \"เริ่มใช้งาน\"",
    (await p.getByRole("button", { name: "เริ่มใช้งาน" }).count()) > 0);
  await p.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await p.waitForTimeout(500);
  check("กดเริ่มใช้งานแล้วปิด", (await d3.count()) === 0);
  await ctx.close();
} finally {
  await b.close();
}

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
