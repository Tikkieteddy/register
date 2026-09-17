/**
 * ทดสอบระบบสิทธิ์ 3 ระดับ
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-roles.mjs
 *
 * สิทธิ์ที่ตรวจ:
 *   ① ผู้ดูแลระบบ (admin)      — เข้าได้ทุกหน้า และเพิ่ม/แก้บัญชีผู้ใช้ได้
 *   ② ผู้จัดงาน (organizer)    — เข้าได้ทุกหน้าเหมือนกัน แต่แก้บัญชีผู้ใช้ไม่ได้
 *   ③ เจ้าหน้าที่หน้างาน (staff) — เข้าหลังบ้านไม่ได้เลย เข้าได้แค่หน้าสแกน
 *
 * ⚠️ ต้องตรวจถึงชั้น server action ด้วย ไม่ใช่แค่ดูว่าปุ่มหายไปจากหน้าจอ
 *    การซ่อนปุ่มกันได้แค่คนที่ไม่ตั้งใจ ส่วนคนที่ตั้งใจยิง action ตรงได้
 *    ถ้ากันแค่ที่หน้าจอ ผู้จัดงานจะเลื่อนสิทธิ์ตัวเองเป็นผู้ดูแลระบบได้
 */
import { launchBrowser } from "./browser.mjs";
import { connect } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const ACCOUNTS = {
  admin: { email: "admin@example.com", password: "admin-dev-1234" },
  organizer: { email: "organizer@example.com", password: "organizer-dev-1234" },
  staff: { email: "staff@example.com", password: "staff-dev-1234" },
};

/** ทุกหน้าในหลังบ้าน — ใช้ตรวจว่าสิทธิ์ไหนเข้าถึงอะไรได้บ้าง */
const CMS_PAGES = [
  "/admin-cms",
  "/admin-cms/dashboard",
  "/admin-cms/registrations",
  "/admin-cms/emails",
  "/admin-cms/links",
  "/admin-cms/media",
  "/admin-cms/settings",
  "/admin-cms/users",
  "/admin-cms/audit",
];

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const sql = connect();
const b = await launchBrowser();

/** ล็อกอินแล้วคืนหน้าที่พร้อมใช้งาน — เคลียร์คุกกี้ก่อนเสมอ */
async function loginAs(role) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const { email, password } = ACCOUNTS[role];
  await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await p.getByRole("heading", { name: "เข้าสู่ระบบ", exact: true }).waitFor({ timeout: 30000 });
  await p.waitForTimeout(1200);
  await p.getByLabel("อีเมล").fill(email);
  await p.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await p.getByRole("heading", { name: "เลือกส่วนที่ต้องการใช้งาน" }).waitFor({ timeout: 30000 });
  return { ctx, p };
}

try {
  // ล้างตัวนับกันยิงถล่มก่อน ไม่งั้นล็อกอิน 3 บัญชีติดกันจะชนเพดานของตัวเอง
  await sql`delete from rate_limits`;

  /* ---------- ① ผู้ดูแลระบบ ---------- */
  console.log("\n① ผู้ดูแลระบบ (admin)");
  {
    const { ctx, p } = await loginAs("admin");

    check(
      "หน้าเลือกทางเข้าแสดงสองปุ่มและกดได้ทั้งคู่",
      (await p.locator('a[href="/admin-cms"]').count()) === 1 &&
        (await p.locator('a[href="/admin-scan"]').count()) === 1,
    );

    let blocked = 0;
    for (const path of CMS_PAGES) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(400);
      if (!p.url().includes("/admin-cms")) blocked++;
    }
    check("เข้าได้ครบทุกหน้าในหลังบ้าน", blocked === 0, `ถูกกัน ${blocked} หน้า`);

    await p.goto(`${BASE}/admin-cms/users`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    check(
      "เห็นปุ่มเพิ่มบัญชีผู้ใช้",
      (await p.getByRole("button", { name: "เพิ่มบัญชีผู้ใช้" }).count()) > 0,
    );
    check(
      "เห็นป้ายบอกสิทธิ์ของตัวเองในเมนู",
      (await p.getByText("ผู้ดูแลระบบ", { exact: true }).count()) > 0,
    );
    await ctx.close();
  }

  /* ---------- ② ผู้จัดงาน ---------- */
  console.log("\n② ผู้จัดงาน (organizer)");
  {
    const { ctx, p } = await loginAs("organizer");

    let blocked = 0;
    for (const path of CMS_PAGES) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(400);
      if (!p.url().includes("/admin-cms")) blocked++;
    }
    check("เข้าได้ครบทุกหน้าในหลังบ้านเหมือนผู้ดูแลระบบ", blocked === 0, `ถูกกัน ${blocked} หน้า`);

    await p.goto(`${BASE}/admin-cms/users`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    check(
      "เปิดหน้าผู้ใช้งานได้ (ดูได้)",
      (await p.getByRole("heading", { name: "ผู้ใช้งาน", exact: true }).count()) > 0,
    );
    check(
      "ไม่มีปุ่มเพิ่มบัญชีผู้ใช้",
      (await p.getByRole("button", { name: "เพิ่มบัญชีผู้ใช้" }).count()) === 0,
    );
    check(
      "ไม่มีปุ่มแก้ไขบัญชี",
      (await p.getByRole("button", { name: /แก้ไข/ }).count()) === 0,
    );
    check(
      "มีคำอธิบายว่าทำไมแก้ไม่ได้",
      (await p.getByText(/ดูรายชื่อได้อย่างเดียว/).count()) > 0,
    );
    check(
      "เห็นป้ายบอกสิทธิ์ว่าเป็นผู้จัดงาน",
      (await p.getByText("ผู้จัดงาน", { exact: true }).count()) > 0,
    );

    /**
     * ด่านสำคัญที่สุดของเทสต์ชุดนี้ — ยิง server action ตรงโดยไม่ผ่านปุ่ม
     *
     * ถ้าด่านฝั่งเซิร์ฟเวอร์ไม่ทำงาน ผู้จัดงานจะเลื่อนสิทธิ์ตัวเองเป็น
     * ผู้ดูแลระบบได้ทันที เท่ากับไม่มีการแบ่งสิทธิ์เลย
     */
    const [before] = await sql`
      select role from users where email = 'organizer@example.com'`;
    const selfPromote = await p.evaluate(async () => {
      const res = await fetch("/admin-cms/users", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8", "Next-Action": "probe" },
        body: "[]",
      });
      return res.status;
    });
    const [after] = await sql`
      select role from users where email = 'organizer@example.com'`;
    check(
      "ยิงคำขอตรงแล้วสิทธิ์ตัวเองไม่ถูกเปลี่ยน",
      before?.role === "organizer" && after?.role === "organizer",
      `ก่อน ${before?.role} หลัง ${after?.role} (HTTP ${selfPromote})`,
    );
    await ctx.close();
  }

  /* ---------- ③ เจ้าหน้าที่หน้างาน ---------- */
  console.log("\n③ เจ้าหน้าที่หน้างาน (staff)");
  {
    const { ctx, p } = await loginAs("staff");

    check(
      "ปุ่มสแกนกดได้",
      (await p.locator('a[href="/admin-scan"]').count()) === 1,
    );
    check(
      "ปุ่มระบบจัดการงานกดไม่ได้ (ไม่ใช่ลิงก์)",
      (await p.locator('a[href="/admin-cms"]').count()) === 0,
    );
    check(
      "บอกเหตุผลว่าทำไมเข้าไม่ได้",
      (await p.getByText(/สิทธิ์เจ้าหน้าที่หน้างานใช้ได้เฉพาะระบบสแกน/).count()) > 0,
    );

    let bounced = 0;
    for (const path of CMS_PAGES) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(400);
      if (!p.url().includes("/admin-cms")) bounced++;
    }
    check(
      "ถูกกันออกจากทุกหน้าในหลังบ้าน",
      bounced === CMS_PAGES.length,
      `กันได้ ${bounced} จาก ${CMS_PAGES.length} หน้า`,
    );
    await ctx.close();
  }
} finally {
  await sql`delete from rate_limits`;
  await sql.end({ timeout: 5 });
  await b.close();
}

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
