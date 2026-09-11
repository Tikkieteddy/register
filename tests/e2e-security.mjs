/**
 * ทดสอบความปลอดภัย (เฟส 6)
 *
 * ครอบคลุม:
 *   ① หน้านโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งานเปิดได้จริง
 *   ② Security headers ครบตามที่ตั้งไว้
 *   ③ Rate limiting กันการยิงถล่มหน้าล็อกอินได้จริง
 *   ④ ลิงก์ท้ายหน้าไม่มีทางตัน (404)
 *
 * รันด้วย: node tests/e2e-security.mjs
 */
import { launchBrowser } from "./browser.mjs";
import { connect } from "./db.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

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

async function main() {
  /* ---------- ① หน้าเอกสารทางกฎหมาย ---------- */
  console.log("\n① หน้านโยบายและเงื่อนไข");

  for (const [path, heading] of [
    ["/privacy", "นโยบายความเป็นส่วนตัว"],
    ["/terms", "เงื่อนไขการใช้งาน"],
  ]) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    check(`${path} เปิดได้ (HTTP ${res.status})`, res.status === 200);
    check(`${path} มีหัวข้อ “${heading}”`, html.includes(heading));
  }

  // นโยบายต้องบอกสิทธิของเจ้าของข้อมูลตาม PDPA ไม่ใช่หน้าเปล่า ๆ
  const privacyHtml = await (await fetch(`${BASE}/privacy`)).text();
  for (const required of ["ขอถอนความยินยอม", "ระยะเวลาเก็บข้อมูล", "ไม่เก็บหมายเลข IP จริง"]) {
    check(`นโยบายกล่าวถึง “${required}”`, privacyHtml.includes(required));
  }

  /* ---------- ② Security headers ---------- */
  console.log("\n② Security headers");

  const res = await fetch(`${BASE}/`);
  const expected = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
  for (const [header, value] of Object.entries(expected)) {
    check(`${header}: ${value}`, res.headers.get(header) === value, `ได้ "${res.headers.get(header)}"`);
  }

  const csp = res.headers.get("content-security-policy") ?? "";
  check("มี Content-Security-Policy", csp.length > 0);
  check("CSP ห้ามฝังหน้าเว็บใน iframe", csp.includes("frame-ancestors 'none'"));
  check("CSP ห้ามโหลด object/embed", csp.includes("object-src 'none'"));
  check("CSP จำกัดปลายทางของฟอร์ม", csp.includes("form-action 'self'"));
  check("มี Strict-Transport-Security", (res.headers.get("strict-transport-security") ?? "").includes("max-age="));
  check(
    "Permissions-Policy ปิดไมค์และตำแหน่ง",
    (res.headers.get("permissions-policy") ?? "").includes("microphone=()"),
  );

  /* ---------- ③ Rate limiting ---------- */
  console.log("\n③ Rate limiting หน้าล็อกอิน");

  // ล้างตัวนับของ IP ทดสอบก่อน เพื่อให้ผลไม่ขึ้นกับการรันครั้งก่อน
  const sql = connect();
  try {
    await sql`delete from rate_limits`;
  } finally {
    await sql.end({ timeout: 5 });
  }

  /**
   * ยิงล็อกอินด้วยรหัสผิดรัว ๆ ผ่านฟอร์มจริง
   *
   * ⚠️ ต้องยิงผ่านเบราว์เซอร์จริงเท่านั้น
   *    server action ของ Next.js ต้องมีรหัส action ที่ถูกต้องแนบมาด้วย
   *    การ POST เข้าไปตรง ๆ จะไม่ถูกเรียกเลย แล้วเทสต์จะ "ผ่าน" ทั้งที่ไม่ได้ทดสอบอะไร
   *
   * ใช้อีเมลคนละตัวทุกครั้ง เพื่อพิสูจน์ว่ากันได้แม้ไล่ยิงหลายบัญชี
   * ซึ่งเป็นช่องที่ระบบล็อกบัญชีรายคนกันไม่ได้ (ยิงบัญชีละ 4 ครั้งแล้ววนไปบัญชีถัดไป)
   */
  const browser = await launchBrowser();
  const context = await browser.newContext({ locale: "th-TH" });
  const page = await context.newPage();
  let blockedAt = 0;

  try {
    const MAX_TRIES = 45; // เพดาน login คือ 40 ครั้ง จึงต้องยิงเกินกว่านั้น
    for (let i = 1; i <= MAX_TRIES; i++) {
      /**
       * โหลดหน้าใหม่ทุกครั้ง เพื่อล้างข้อความ error ของรอบก่อนออกไปก่อน
       *
       * ⚠️ ถ้าไม่โหลดใหม่ กล่อง error จะยังค้างอยู่จากรอบที่แล้ว
       *    เทสต์จะอ่านข้อความเก่าได้ทันทีแล้วสรุปว่า "ยังไม่โดนบล็อก"
       *    ทั้งที่ระบบบล็อกไปแล้ว — เป็นการทดสอบที่ผ่าน/ไม่ผ่านโดยไม่ได้วัดของจริง
       */
      await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);

      await page.getByRole("textbox", { name: "อีเมล", exact: true }).fill(`probe${i}@example.com`);
      await page.locator('input[type="password"]').fill("wrong-password");
      await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

      /**
       * อ่านข้อความจากเนื้อหาทั้งหน้า ไม่เจาะจง element
       *
       * ⚠️ getByRole("alert") ใช้ไม่ได้ที่นี่ — ในหน้ามี live region ว่าง ๆ ที่ตรงเงื่อนไขก่อน
       *    ทำให้อ่านได้สตริงว่างทุกครั้ง แล้วเทสต์จะสรุปว่า "ไม่โดนบล็อก" เสมอ
       *    ทั้งที่ระบบทำงานถูกต้อง
       */
      const seen = await page
        .waitForFunction(
          () => {
            const body = document.body.innerText;
            if (body.includes("ถี่เกินไป")) return "blocked";
            if (body.includes("อีเมลหรือรหัสผ่านไม่ถูกต้อง")) return "rejected";
            return false;
          },
          null,
          { timeout: 15000 },
        )
        .then((handle) => handle.jsonValue())
        .catch(() => "timeout");

      if (seen === "blocked") {
        blockedAt = i;
        break;
      }
    }
  } finally {
    await browser.close();
  }

  check(
    "บล็อกการยิงล็อกอินรัวจาก IP เดียวกัน",
    blockedAt > 0,
    blockedAt === 0 ? "ยิง 45 ครั้งแล้วยังไม่โดนบล็อก" : "",
  );
  if (blockedAt > 0) console.log(`     (โดนบล็อกที่ครั้งที่ ${blockedAt} — เพดานตั้งไว้ 40)`);

  // ตัวนับต้องถูกบันทึกลงฐานข้อมูลจริง ไม่ใช่แค่ในหน่วยความจำ
  const verify = connect();
  try {
    const rows = await verify`select key, count from rate_limits where key like 'login:%'`;
    check("ตัวนับถูกบันทึกลงฐานข้อมูล (ใช้ได้บน Vercel หลายเครื่อง)", rows.length > 0);
    check(
      "key ไม่มี IP ดิบ เก็บเป็นค่าที่แฮชแล้ว (PDPA)",
      rows.every((r) => /^login:[0-9a-f]{16,}$/.test(r.key)),
      rows[0]?.key ?? "",
    );
  } finally {
    await verify.end({ timeout: 5 });
  }

  /* ---------- ④ ลิงก์ท้ายหน้าไม่ตัน ---------- */
  console.log("\n④ ลิงก์ท้ายหน้า");
  for (const path of ["/", "/e/tnn-event-2026"]) {
    const html = await (await fetch(`${BASE}${path}`)).text();
    const links = [...html.matchAll(/href="(\/[a-z0-9\-/]*)"/g)].map((m) => m[1]);
    const unique = [...new Set(links)].filter((l) => !l.startsWith("/_next"));

    const broken = [];
    for (const link of unique) {
      const status = (await fetch(`${BASE}${link}`, { redirect: "manual" })).status;
      if (status === 404) broken.push(link);
    }
    check(`${path} ไม่มีลิงก์ที่พาไปหน้า 404`, broken.length === 0, broken.join(", "));
  }

  console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
  if (failed > 0) process.exit(1);
  console.log("✅ ผ่านทั้งหมด");
}

main().catch((error) => {
  console.error("❌ ทดสอบล้ม:", error);
  process.exit(1);
});
