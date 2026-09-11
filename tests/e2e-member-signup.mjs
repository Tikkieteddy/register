/**
 * ทดสอบหน้าสมัครสมาชิก (/register)
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-member-signup.mjs
 *
 * ครอบคลุม: บังคับเฉพาะ 3 ช่อง · ตรวจรูปแบบอีเมลและเบอร์ · ต้องยินยอมก่อนส่ง ·
 * กันอีเมลซ้ำ · หน้าเว็บสาธารณะต้องไม่มีลิงก์ไปหลังบ้าน
 *
 * ⚠️ เทสต์เขียนข้อมูลลงฐานข้อมูล ต้องลบของตัวเองทิ้งใน finally เสมอ
 */
import { launchBrowser } from "./browser.mjs";
import { connect } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const MARK = `mem${Date.now()}`;
const EMAIL = `${MARK}@example.test`;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

const sql = connect();
const b = await launchBrowser();

try {
  await sql`delete from members where email like ${"mem%@example.test"}`;

  const ctx = await b.newContext();
  const p = await ctx.newPage();

  /* ---------- ① หน้าสาธารณะต้องไม่มีลิงก์ไปหลังบ้าน ---------- */
  console.log("\n① หน้าเว็บสาธารณะต้องไม่ชี้ทางเข้าหลังบ้าน");
  for (const path of ["/", "/register"]) {
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(800);
    const adminLinks = await p.locator('a[href^="/admin"]').count();
    check(`${path} ไม่มีลิงก์ไปหลังบ้าน`, adminLinks === 0, `พบ ${adminLinks} ลิงก์`);
  }

  const signUpLinks = await p.locator('a[href="/register"]').count();
  check("มีลิงก์สมัครสมาชิกในเมนู", signUpLinks > 0);

  /* ---------- ② บังคับเฉพาะ 3 ช่อง ---------- */
  console.log("\n② บังคับกรอกเฉพาะ ชื่อ นามสกุล อีเมล");
  await p.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  await p.getByRole("heading", { name: "สมัครสมาชิก", exact: true }).waitFor({ timeout: 20000 });
  await p.waitForTimeout(1200);

  await p.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await p.waitForTimeout(1200);
  const alerts = await p.locator('[role="alert"]').allInnerTexts();
  const joined = alerts.join(" ");
  check("กดส่งทั้งที่ยังไม่กรอก ขึ้นข้อความบอกทุกช่องที่จำเป็น",
    alerts.length >= 3, `พบ ${alerts.length} ข้อความ`);
  check("ไม่บังคับเบอร์โทรและที่อยู่",
    !joined.includes("เบอร์โทรศัพท์ไม่ถูกต้อง") && !joined.includes("ที่อยู่ยาวเกินไป"));

  /* ---------- ③ ต้องยินยอมก่อนส่ง ---------- */
  console.log("\n③ ต้องยอมรับนโยบายก่อนสมัคร");
  await p.getByLabel("ชื่อ", { exact: false }).first().fill("ทดสอบ");
  await p.locator("#lastName").fill("สมาชิก");
  await p.locator("#email").fill(EMAIL);
  await p.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await p.waitForTimeout(1200);
  const consentMsg = (await p.locator('[role="alert"]').allInnerTexts()).join(" ");
  check("ยังไม่ติ๊กยินยอม สมัครไม่ได้", consentMsg.includes("นโยบายความเป็นส่วนตัว"));

  /* ---------- ④ สมัครสำเร็จ ---------- */
  console.log("\n④ กรอกครบแล้วสมัครได้");
  await p.locator('input[type="checkbox"]').first().check();
  await p.locator("#phone").fill("0812345678");
  await p.locator("#address").fill("123 ถนนทดสอบ กรุงเทพฯ 10110");
  await p.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await p.getByText("สมัครสมาชิกเรียบร้อยแล้ว").waitFor({ timeout: 20000 });
  check("สมัครสำเร็จและขึ้นหน้ายืนยัน", true);

  const [row] = await sql`select * from members where email = ${EMAIL}`;
  check("ข้อมูลถูกบันทึกลงฐานข้อมูลครบ",
    row?.first_name === "ทดสอบ" && row?.phone === "0812345678" &&
    String(row?.address).includes("ถนนทดสอบ"),
    JSON.stringify({ first: row?.first_name, phone: row?.phone }));
  check("เก็บ IP แบบแฮชเท่านั้น ไม่เก็บค่าดิบ (PDPA)",
    !row?.ip_hash || (row.ip_hash.length === 64 && !row.ip_hash.includes(".")));
  check("บันทึกเวอร์ชันนโยบายที่ยินยอมไว้เป็นหลักฐาน", Boolean(row?.policy_version));

  /* ---------- ⑤ อีเมลซ้ำ ---------- */
  console.log("\n⑤ กันสมัครซ้ำด้วยอีเมลเดิม");
  await p.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.locator("#firstName").fill("ทดสอบ");
  await p.locator("#lastName").fill("ซ้ำ");
  await p.locator("#email").fill(EMAIL);
  await p.locator('input[type="checkbox"]').first().check();
  await p.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await p.waitForTimeout(1500);
  const dupMsg = (await p.locator('[role="alert"]').allInnerTexts()).join(" ");
  check("อีเมลที่สมัครแล้ว สมัครซ้ำไม่ได้", dupMsg.includes("สมัครสมาชิกไว้แล้ว"), dupMsg.slice(0, 80));

  const count = await sql`select count(*)::int as n from members where email = ${EMAIL}`;
  check("ไม่มีแถวซ้ำเกิดขึ้นในฐานข้อมูล", count[0].n === 1, `พบ ${count[0].n} แถว`);

  await ctx.close();
} finally {
  console.log("\n🧹 ลบข้อมูลที่เทสต์สร้างขึ้น");
  await sql`delete from members where email like ${"mem%@example.test"}`;
  await sql.end({ timeout: 5 });
  await b.close();
}

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
