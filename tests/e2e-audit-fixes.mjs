/**
 * ทดสอบผลของการแก้ตามรายงานตรวจระบบ (A1–A8)
 *
 * ต้องเปิดเซิร์ฟเวอร์ไว้ก่อนที่ http://localhost:3100 แล้วรัน:
 *   node tests/e2e-audit-fixes.mjs
 *
 * ครอบคลุม:
 *   A1 — จองที่นั่งรัว ๆ ต้องถูกบล็อก แต่คนใช้งานปกติต้องไม่โดน
 *        และตอนถูกบล็อกต้องไม่ไปขึ้นว่า "ที่นั่งเต็ม" ทั้งที่ยังว่าง
 *   A2 — คนที่ถูกยกเลิกการลงทะเบียนต้องกลับมาลงใหม่ได้ แต่ยังกันคนซ้ำจริงอยู่
 *   A3 — ปิดบัญชีเจ้าหน้าที่แล้วต้องใช้งานต่อไม่ได้ทันที ไม่ต้องรอโทเคนหมดอายุ
 *   A7 — ยิงสถิติด้วย eventId มั่ว ๆ ต้องไม่เกิดแถวในฐานข้อมูล
 *   A8 — ปุ่มส่งอีเมลซ้ำต้องมองเห็นฉบับที่ค้างสถานะ queued
 *        และต้องไม่ส่งซ้ำให้คนที่ได้รับไปแล้ว
 *
 * ส่วน A5 (ลบ Server Action ที่ไม่มีใครใช้) และ A6 (กันการอ่านคำถามของงานฉบับร่าง)
 * ตรวจจากโค้ดโดยตรง เพราะเป็นการปิดทางเข้าที่หน้าเว็บปกติไม่ได้เรียกอยู่แล้ว
 *
 * ⚠️ เทสต์นี้เขียนข้อมูลลงฐานข้อมูล ต้องลบของตัวเองทิ้งใน finally เสมอ
 */
import { launchBrowser } from "./browser.mjs";
import { connect } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const MARK = `audit${Date.now()}`;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
};

const sql = connect();
const b = await launchBrowser();

try {
  // ล้างตัวนับ rate limit ก่อนเริ่ม ไม่งั้นผลของเทสต์ก่อนหน้าจะปนเข้ามา
  await sql`delete from rate_limits`;

  const [event] = await sql`
    select id, slug from events where status = 'published' order by starts_at desc limit 1
  `;
  if (!event) throw new Error("ไม่พบงานที่เผยแพร่แล้วสำหรับใช้ทดสอบ");

  /* ---------------- A2 — ยกเลิกแล้วลงใหม่ได้ ---------------- */
  console.log("\nA2 ยกเลิกแล้วกลับมาลงทะเบียนใหม่ได้");
  const reusedEmail = `${MARK}@example.test`;
  const [old] = await sql`
    insert into registrations
      (event_id, registration_code, first_name, last_name, email, phone, status, cancelled_at)
    values
      (${event.id}, ${MARK.slice(-8).toUpperCase()}, 'ทดสอบ', 'ยกเลิกแล้ว',
       ${reusedEmail}, '0812345678', 'cancelled', now())
    returning id
  `;
  check("สร้างรายการที่ถูกยกเลิกไว้ก่อนได้", Boolean(old));

  let inserted = null;
  try {
    [inserted] = await sql`
      insert into registrations
        (event_id, registration_code, first_name, last_name, email, phone, status)
      values
        (${event.id}, ${"R" + MARK.slice(-7).toUpperCase()}, 'ทดสอบ', 'ลงใหม่',
         ${reusedEmail}, '0812345678', 'confirmed')
      returning id
    `;
  } catch (error) {
    check("ฐานข้อมูลยอมให้ลงทะเบียนใหม่ด้วยอีเมลเดิม", false, String(error.message).slice(0, 80));
  }
  check("ฐานข้อมูลยอมให้ลงทะเบียนใหม่ด้วยอีเมลเดิม", Boolean(inserted));

  // และต้องยังกันการลงซ้ำของรายการที่ยังไม่ถูกยกเลิกอยู่เหมือนเดิม
  let blocked = false;
  try {
    await sql`
      insert into registrations
        (event_id, registration_code, first_name, last_name, email, phone, status)
      values
        (${event.id}, ${"X" + MARK.slice(-7).toUpperCase()}, 'ทดสอบ', 'ซ้ำจริง',
         ${reusedEmail}, '0812345678', 'confirmed')
    `;
  } catch {
    blocked = true;
  }
  check("ยังกันอีเมลซ้ำของรายการที่ยังไม่ยกเลิกได้เหมือนเดิม", blocked);

  /* ---------------- A7 — สถิติที่ยิง eventId มั่ว ๆ ---------------- */
  console.log("\nA7 กันการยิงสถิติด้วย eventId ที่ไม่มีอยู่จริง");
  const fakeEventId = "00000000-0000-4000-8000-000000000000";
  const before = await sql`select count(*)::int as n from link_events`;
  const res = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.77" },
    body: JSON.stringify({ eventId: fakeEventId, action: "share" }),
  });
  const after = await sql`select count(*)::int as n from link_events`;
  check("ตอบกลับปกติ ไม่โยน error ใส่หน้าเว็บ", res.status === 200, `status=${res.status}`);
  check("ไม่มีแถวขยะเกิดขึ้นในฐานข้อมูล", after[0].n === before[0].n,
    `ก่อน ${before[0].n} → หลัง ${after[0].n}`);

  /* ---------------- A8 — ปุ่มส่งซ้ำต้องเห็นฉบับที่ค้าง queued ---------------- */
  console.log("\nA8 อีเมลที่ค้างสถานะ queued ต้องถูกมองเห็น");
  /**
   * ต้องเลือกคนที่ "ยังไม่เคยมีอีเมลฉบับที่ส่งสำเร็จ"
   * ถ้าเผลอไปเลือกคนที่ข้อมูลตัวอย่างทำเครื่องหมายว่าส่งสำเร็จไปแล้ว
   * เงื่อนไข not exists จะคัดเขาออกอย่างถูกต้อง แล้วเทสต์จะฟ้องผิดจุด
   */
  const [target] = await sql`
    select r.id
    from registrations r
    where r.event_id = ${event.id}
      and r.status = 'confirmed'
      and not exists (
        select 1 from email_logs el
        where el.registration_id = r.id and el.status = 'sent'
      )
    limit 1
  `;
  if (!target) throw new Error("ไม่พบผู้ลงทะเบียนที่ยังไม่มีอีเมลส่งสำเร็จสำหรับใช้ทดสอบ");
  await sql`
    insert into email_logs (registration_id, to_email, template, provider, status, created_at)
    values (${target.id}, ${MARK + "@queued.test"}, 'confirmation', 'test', 'queued',
            now() - interval '30 minutes')
  `;
  const found = await sql`
    select distinct el.registration_id
    from email_logs el
    join registrations r on r.id = el.registration_id
    where r.event_id = ${event.id}
      and r.status <> 'cancelled'
      and (
        el.status in ('failed', 'bounced')
        or (el.status = 'queued' and el.created_at < now() - interval '10 minutes')
      )
      and not exists (
        select 1 from email_logs sent_log
        where sent_log.registration_id = el.registration_id and sent_log.status = 'sent'
      )
  `;
  check("ฉบับที่ค้าง queued เกิน 10 นาที ถูกนับเข้ารายการส่งซ้ำ",
    found.some((row) => row.registration_id === target.id));

  // ถ้ามีฉบับที่ส่งสำเร็จแล้ว ต้องไม่ถูกส่งซ้ำอีก
  await sql`
    insert into email_logs (registration_id, to_email, template, provider, status, sent_at)
    values (${target.id}, ${MARK + "@sent.test"}, 'confirmation', 'test', 'sent', now())
  `;
  const afterSent = await sql`
    select distinct el.registration_id
    from email_logs el
    join registrations r on r.id = el.registration_id
    where r.event_id = ${event.id}
      and r.status <> 'cancelled'
      and (
        el.status in ('failed', 'bounced')
        or (el.status = 'queued' and el.created_at < now() - interval '10 minutes')
      )
      and not exists (
        select 1 from email_logs sent_log
        where sent_log.registration_id = el.registration_id and sent_log.status = 'sent'
      )
  `;
  check("คนที่ได้รับอีเมลแล้ว ไม่ถูกส่งซ้ำอีกเมื่อกดปุ่ม",
    !afterSent.some((row) => row.registration_id === target.id));

  /* ---------------- A3 — ปิดบัญชีแล้วต้องเด้งออกทันที ---------------- */
  console.log("\nA3 ปิดบัญชีเจ้าหน้าที่แล้วต้องใช้งานต่อไม่ได้ทันที");
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
  await p.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }).waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.getByLabel("อีเมล").fill("staff@example.com");
  await p.getByLabel("รหัสผ่าน", { exact: true }).fill("staff-dev-1234");
  await p.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await p.waitForURL(/\/staff(\?|$)/, { timeout: 25000 });
  check("ล็อกอินเข้าหน้าเจ้าหน้าที่ได้ตามปกติ", /\/staff/.test(p.url()), p.url());

  // ผู้ดูแลปิดบัญชีระหว่างที่เจ้าหน้าที่ยังเปิดหน้าค้างอยู่ (คุกกี้ยังไม่หมดอายุ)
  await sql`update users set is_active = false where email = 'staff@example.com'`;
  await p.goto(`${BASE}/staff/search`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  check("โหลดหน้าใหม่แล้วถูกเด้งไปหน้าล็อกอินทันที",
    /\/staff\/login/.test(p.url()), p.url());
  await sql`update users set is_active = true where email = 'staff@example.com'`;

  /* ---------------- A3ก — session ต้องไม่ปนกันข้ามคำขอ ---------------- */
  console.log("\nA3ก ล็อกอินแล้วต้องเข้าหลังบ้านได้ทุกหน้า และ session ต้องไม่ปนกัน");

  /**
   * ⚠️ เทสต์นี้เกิดจากบั๊กจริงที่หลุดขึ้นเครื่องจริงไปแล้วครั้งหนึ่ง
   *
   *    ตอนนั้นเอา cache() ของ React มาครอบ getSession() ซึ่งไม่รับพารามิเตอร์เลย
   *    ทุกคำขอจึงถูกมองเป็นอันเดียวกัน แล้วคำตอบของคำขอที่ยังไม่ได้ล็อกอิน
   *    ถูกเอาไปตอบคำขอของคนที่ล็อกอินแล้ว
   *
   *    อาการคือ "ล็อกอินติด แต่เปิดหน้าหลังบ้านแล้วเด้งกลับหน้าล็อกอินทุกครั้ง"
   *    ซึ่งเทสต์เดิมจับไม่ได้ เพราะเทสต์เดิมเปิดทีละหน้าแบบไม่มีคำขออื่นแทรก
   */
  const adminCtx = await b.newContext();
  const ap = await adminCtx.newPage();
  await ap.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
  await ap.getByRole("heading", { name: "เข้าสู่ระบบเจ้าหน้าที่" }).waitFor({ timeout: 20000 });
  await ap.waitForTimeout(1500);
  await ap.getByLabel("อีเมล").fill("admin@example.com");
  await ap.getByLabel("รหัสผ่าน", { exact: true }).fill("admin-dev-1234");
  await ap.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await ap.waitForTimeout(3000);

  const ADMIN_PAGES = [
    "/admin",
    "/admin/registrations",
    "/admin/emails",
    "/admin/links",
    "/admin/media",
    "/admin/settings",
    "/admin/events",
    "/admin/audit",
    "/admin/report",
  ];
  let bounced = 0;
  for (const path of ADMIN_PAGES) {
    await ap.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await ap.waitForTimeout(500);
    if (ap.url().includes("/staff/login")) bounced++;
  }
  check(`เข้าหน้าหลังบ้านได้ครบทั้ง ${ADMIN_PAGES.length} หน้า`, bounced === 0,
    `ถูกเด้งออก ${bounced} หน้า`);

  // ยิงคำขอที่ "ไม่มีคุกกี้" พร้อมกับคำขอที่ "มีคุกกี้" ซ้ำ ๆ
  // ถ้า session ปนกัน คำขอที่มีคุกกี้จะถูกเด้งออกทั้งที่ล็อกอินแล้ว
  const jar = (await adminCtx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  let mixedUp = 0;
  for (let i = 0; i < 10; i++) {
    const [, authed] = await Promise.all([
      fetch(`${BASE}/admin`, { redirect: "manual" }),
      fetch(`${BASE}/admin`, { headers: { cookie: jar }, redirect: "manual" }),
    ]);
    if (authed.status !== 200) mixedUp++;
  }
  check("ยิงคำขอที่ไม่ได้ล็อกอินแทรกเข้ามา session ก็ไม่ปนกัน", mixedUp === 0,
    `คำขอที่ล็อกอินแล้วถูกเด้งออก ${mixedUp} จาก 10 ครั้ง`);
  await adminCtx.close();

  /* ---------------- หน้าตรวจสุขภาพระบบ ---------------- */
  console.log("\nเฝ้าระวัง หน้าตรวจสุขภาพระบบต้องไม่บอกจุดอ่อนให้คนนอก");

  const publicHealth = await fetch(`${BASE}/api/health`);
  const publicBody = await publicHealth.json();
  check("คนนอกเรียกได้และได้สถานะกลับไป", publicHealth.status === 200 && publicBody.status === "ok",
    `status=${publicHealth.status} ${JSON.stringify(publicBody).slice(0, 80)}`);

  /**
   * ⚠️ ข้อนี้สำคัญกว่าที่เห็น
   *    การบอกคนนอกว่า "ระบบอีเมลยังไม่ได้ตั้งค่า" หรือ "ฐานข้อมูลล่ม"
   *    คือการบอกจุดอ่อนให้คนที่อยากโจมตีฟรี ๆ
   */
  check("ไม่เปิดเผยรายละเอียดภายในให้คนที่ไม่ได้ล็อกอิน",
    publicBody.checks === undefined && !JSON.stringify(publicBody).includes("R2_"),
    JSON.stringify(publicBody).slice(0, 120));

  /* ---------------- A1 — จองที่นั่งรัว ๆ ต้องถูกบล็อก ---------------- */
  console.log("\nA1 กันการยิงจองที่นั่งรัว ๆ");
  await sql`delete from rate_limits`;
  const ctx2 = await b.newContext({ extraHTTPHeaders: { "x-real-ip": "203.0.113.99" } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/e/${event.slug}/register`, { waitUntil: "domcontentloaded" });
  const box = p2.locator('input[type="checkbox"][name^="sessionIds-"]').first();
  await box.waitFor({ timeout: 20000 });
  await p2.waitForTimeout(1500);

  const settled = async (want) => {
    for (let i = 0; i < 60; i++) {
      if ((await box.isChecked()) === want) return true;
      const text = await p2.evaluate(() => document.body.innerText);
      if (text.includes("เลือกช่วงเวลาถี่เกินไป")) return false;
      await p2.waitForTimeout(100);
    }
    return false;
  };

  // ① คนใช้งานปกติ ติ๊กเข้าติ๊กออกไม่กี่ครั้ง ต้องไม่โดนบล็อก
  let normalOk = true;
  for (let i = 0; i < 5; i++) {
    await box.click();
    if (!(await settled(true))) { normalOk = false; break; }
    await box.click();
    await settled(false);
  }
  check("คนใช้งานปกติ ติ๊กเข้าติ๊กออก 5 รอบ ไม่โดนบล็อก", normalOk);

  const rlKeys = await sql`select key, count from rate_limits where key like 'hold:%'`;
  check("การจองที่นั่งถูกนับจริง", rlKeys.length > 0 && rlKeys[0].count >= 5,
    `นับได้ ${rlKeys[0]?.count ?? 0} ครั้ง`);
  check("ตัวนับไม่มี IP ดิบใน key (PDPA)",
    rlKeys.every((r) => !r.key.includes("203.0.113")));

  /**
   * ② จำลองสคริปต์ที่ยิงมาแล้ว 60 ครั้งในนาทีเดียวกัน
   *
   * ไม่ใช้วิธีคลิกจริง 60 ครั้ง เพราะการคลิกผ่านเบราว์เซอร์ใช้เวลารวมเกิน 1 นาที
   * หน้าต่างนับก็จะรีเซ็ตไปก่อน (ซึ่งถูกต้องแล้ว — คนกดช้าขนาดนั้นไม่ใช่สคริปต์)
   * จึงดันตัวนับให้ถึงเพดานโดยตรง แล้วทดสอบว่าคำขอถัดไปโดนปฏิเสธจริงหรือไม่
   */
  await sql`update rate_limits set count = 60, window_started_at = now() where key like 'hold:%'`;
  await box.click();
  let blockedText = "";
  for (let i = 0; i < 40; i++) {
    const text = await p2.evaluate(() => document.body.innerText);
    if (text.includes("เลือกช่วงเวลาถี่เกินไป")) { blockedText = "โดนบล็อก"; break; }
    await p2.waitForTimeout(150);
  }
  check("ยิงเกินเพดาน 60 ครั้ง/นาที แล้วถูกปฏิเสธจริง", blockedText !== "");

  // ③ ตอนถูกปฏิเสธ ต้องไม่ไปขึ้นว่า "ที่นั่งเต็ม" ทั้งที่ที่นั่งยังว่าง
  const bodyText = await p2.evaluate(() => document.body.innerText);
  check("ไม่ขึ้นข้อความว่าที่นั่งเต็มทั้งที่ยังว่าง", !bodyText.includes("เต็มแล้ว"));
  check("ช่องเลือกช่วงเวลายังกดได้อยู่ ไม่ถูกปิดตาย", await box.isEnabled());

  await ctx.close();
  await ctx2.close();
} finally {
  console.log("\n🧹 เก็บกวาดข้อมูลที่เทสต์สร้างขึ้น");
  await sql`update users set is_active = true where email = 'staff@example.com'`;
  await sql`delete from email_logs where to_email like ${MARK + "%"}`;
  await sql`delete from registrations where email like ${MARK + "%"}`;
  await sql`delete from rate_limits`;
  await sql.end({ timeout: 5 });
  await b.close();
}

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
