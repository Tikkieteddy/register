/**
 * ทดสอบระบบหลายอีเวนต์ (เฟส 5.5)
 *
 * ครอบคลุม 3 อย่างที่เพิ่มเข้ามา:
 *   ① หน้าแรกรวมงาน — แยกกลุ่ม "กำลังเปิดรับสมัคร" กับ "งานที่ผ่านมา"
 *   ② สร้างงานใหม่จากหลังบ้าน
 *   ③ สลับงานที่กำลังจัดการ แล้วหน้าอื่นต้องเห็นงานเดียวกัน
 *
 * รันด้วย: node tests/e2e-multi-event.mjs
 * ต้องมีเซิร์ฟเวอร์รันอยู่ที่ BASE (ค่าเริ่มต้น http://localhost:3100 เหมือนเทสต์ตัวอื่น)
 */
import { launchBrowser } from "./browser.mjs";
import { deleteEventsByPrefix } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "admin-dev-1234";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** ชื่อไม่ซ้ำทุกครั้งที่รัน จะได้รันซ้ำได้โดยไม่ต้องล้างฐานข้อมูลก่อน */
const stamp = Date.now().toString().slice(-6);
const SLUG_PREFIX = "test-multi-";
const NEW_NAME = `งานทดสอบหลายอีเวนต์ ${stamp}`;
const NEW_SLUG = `${SLUG_PREFIX}${stamp}`;

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext({ locale: "th-TH" });
  const page = await context.newPage();

  try {
    /* ---------- ① หน้าแรก ---------- */
    console.log("\n① หน้าแรกรวมงาน");
    await page.goto(BASE, { waitUntil: "domcontentloaded" });

    check("หน้าแรกเปิดได้", await page.getByRole("heading", { name: "งานทั้งหมด" }).isVisible());
    check(
      "มีหัวข้อ “กำลังเปิดรับสมัคร”",
      await page.getByRole("heading", { name: /กำลังเปิดรับสมัคร/ }).isVisible(),
    );
    check(
      "แสดงงานตัวอย่างที่เผยแพร่แล้ว",
      await page.getByRole("link", { name: /TNN Event 2026/ }).first().isVisible(),
    );
    check(
      "การ์ดงานลิงก์ไปหน้ารายละเอียดงาน",
      (await page.getByRole("link", { name: /TNN Event 2026/ }).first().getAttribute("href")) ===
        "/e/tnn-event-2026",
    );

    // งานฉบับร่างต้องไม่โผล่บนหน้าแรก
    const bodyText = await page.locator("body").innerText();
    check("ไม่แสดงงานฉบับร่างบนหน้าแรก", !bodyText.includes("ฉบับร่าง"));

    /* ---------- ② สร้างงานใหม่ ---------- */
    console.log("\n② สร้างงานใหม่จากหลังบ้าน");
    await page.goto(`${BASE}/staff/login?next=/admin/events`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.getByRole("textbox", { name: "อีเมล", exact: true }).fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await page.waitForURL(/\/admin\/events/, { timeout: 15000 });

    const eventsHeading = page.getByRole("heading", { name: "จัดการงาน" });
    // waitForURL คืนค่าทันทีที่ URL เปลี่ยน แต่เนื้อหายังอาจวาดไม่เสร็จ ต้องรอหัวข้อจริงก่อน
    await eventsHeading.waitFor({ state: "visible", timeout: 15000 });
    check("เข้าหน้าจัดการงานได้", await eventsHeading.isVisible());

    await page.waitForTimeout(1500);
    await page.getByRole("textbox", { name: /ชื่องาน \(ภาษาไทย\)/ }).fill(NEW_NAME);

    const slugField = page.getByRole("textbox", { name: /ชื่อลิงก์/ });
    const autoSlug = await slugField.inputValue();
    check("เดาชื่อลิงก์ให้อัตโนมัติ", autoSlug.length > 0, `ได้ "${autoSlug}"`);

    await slugField.fill(NEW_SLUG);
    await page.locator('input[type="date"]').fill("2027-05-20");
    await page.getByRole("button", { name: "สร้างงาน" }).click();

    // สร้างเสร็จแล้วระบบพาไปหน้าตั้งค่างาน และสลับมางานใหม่ให้เลย
    await page.waitForURL(/\/admin\/settings/, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const settingsText = await page.locator("body").innerText();
    check("สร้างงานสำเร็จและสลับมางานใหม่ให้อัตโนมัติ", settingsText.includes(NEW_NAME));

    /* ---------- ③ สลับงาน ---------- */
    console.log("\n③ สลับงานที่กำลังจัดการ");
    await page.goto(`${BASE}/admin/events`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    check(
      "หน้ารายการงานแสดงงานใหม่",
      (await page.locator("body").innerText()).includes(NEW_SLUG),
    );
    check(
      "งานใหม่เป็นฉบับร่าง",
      (await page.locator("body").innerText()).includes("ฉบับร่าง"),
    );

    // สลับกลับไปงานเดิม
    await page.getByRole("button", { name: "สลับมางานนี้" }).first().click();
    await page.waitForTimeout(2500);

    // ไปหน้าอื่นแล้วต้องยังเป็นงานเดิมที่เลือกไว้ (พิสูจน์ว่าคุกกี้ทำงาน ไม่ใช่แค่หน้าเดียว)
    await page.goto(`${BASE}/admin/registrations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const afterSwitch = await page.locator("body").innerText();
    check(
      "หน้าอื่นในหลังบ้านเห็นงานเดียวกันหลังสลับ",
      afterSwitch.includes("TNN Event 2026"),
      "ตัวสลับงานต้องจำข้ามหน้าได้",
    );

    /* ---------- ④ งานฉบับร่างต้องไม่หลุดออกหน้าเว็บสาธารณะ ---------- */
    console.log("\n④ งานฉบับร่างต้องไม่เปิดให้คนทั่วไปลงทะเบียน");
    await page.goto(`${BASE}/e/${NEW_SLUG}`, { waitUntil: "domcontentloaded" });
    const draftPage = await page.locator("body").innerText();
    check(
      "หน้างานฉบับร่างไม่มีปุ่มลงทะเบียน",
      draftPage.includes("ปิดรับลงทะเบียน") || draftPage.includes("ยังไม่เปิดรับ"),
    );

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    check(
      "งานฉบับร่างไม่โผล่บนหน้าแรก",
      !(await page.locator("body").innerText()).includes(NEW_NAME),
    );
  } finally {
    await browser.close();

    /**
     * ⚠️ ต้องลบงานทดสอบทิ้งเสมอ แม้เทสต์จะล้มกลางคัน
     *    งานที่สร้างไว้ตั้งวันเป็นปี 2027 ซึ่งใหม่กว่างานตัวอย่าง
     *    ถ้าปล่อยค้างไว้ หลังบ้านจะเปิดงานทดสอบนี้เป็นค่าเริ่มต้นให้
     *    แล้วเทสต์หลังบ้านตัวอื่นจะล้มทั้งหมดโดยหาสาเหตุไม่เจอ
     */
    const removed = await deleteEventsByPrefix(SLUG_PREFIX);
    console.log(`\n🧹 ลบงานทดสอบทิ้ง ${removed.length} งาน: ${removed.join(", ") || "(ไม่มี)"}`);
  }

  console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
  if (failed > 0) process.exit(1);
  console.log("✅ ผ่านทั้งหมด");
}

main().catch((error) => {
  console.error("❌ ทดสอบล้ม:", error);
  process.exit(1);
});
