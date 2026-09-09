/**
 * ตรวจความพร้อมก่อน deploy ขึ้นเครื่องจริง
 *
 * รันด้วย: npm run check:deploy
 *
 * ตรวจ 3 อย่าง:
 *   ① environment variables ครบและถูกรูปแบบหรือไม่
 *   ② ต่อฐานข้อมูลได้จริงหรือไม่ และ migration ครบหรือยัง
 *   ③ ค่าที่ตั้งไว้สมเหตุสมผลกับการใช้งานจริงหรือไม่ (เช่น URL ยังเป็น localhost อยู่)
 *
 * ออกด้วยรหัส 1 ถ้ามีข้อที่ต้องแก้ก่อน deploy
 */
// โหลด .env.local ก่อนทุกอย่าง เพราะสคริปต์นี้รันนอก Next.js
import "../src/lib/load-env";
import { sql } from "drizzle-orm";

type Level = "error" | "warn" | "ok";
type Check = { level: Level; message: string; fix?: string };

const results: Check[] = [];
const add = (level: Level, message: string, fix?: string) =>
  results.push({ level, message, fix });

function required(name: string, why: string, fix: string): string | null {
  const value = process.env[name];
  if (!value) {
    add("error", `ขาด ${name} — ${why}`, fix);
    return null;
  }
  add("ok", `${name} ตั้งค่าแล้ว`);
  return value;
}

function optional(name: string, why: string, fix: string): string | null {
  const value = process.env[name];
  if (!value) {
    add("warn", `ยังไม่ได้ตั้ง ${name} — ${why}`, fix);
    return null;
  }
  add("ok", `${name} ตั้งค่าแล้ว`);
  return value;
}

async function main() {
  console.log("\n🔍 ตรวจความพร้อมก่อน deploy\n");

  // ---------- ① ค่าที่ขาดไม่ได้ ----------
  const databaseUrl = required(
    "DATABASE_URL",
    "ระบบทำงานไม่ได้เลยถ้าไม่มีฐานข้อมูล",
    "Supabase → Project Settings → Database → Connection string (URI)",
  );

  const siteUrl = required(
    "NEXT_PUBLIC_SITE_URL",
    "ใช้สร้างลิงก์ในอีเมล ลิงก์ QR และลิงก์ติดตามผล",
    "ใส่โดเมนจริงเต็ม ๆ เช่น https://register.tnn.co.th",
  );

  const hashSalt = required(
    "HASH_SALT",
    "ระบบต้องแฮช IP ก่อนบันทึกตามข้อกำหนด PDPA",
    'สร้างด้วย: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );

  const sessionSecret = required(
    "SESSION_SECRET",
    "ใช้เซ็น session ของเจ้าหน้าที่และผู้ดูแล ถ้าไม่มีจะล็อกอินไม่ได้เลย",
    'สร้างด้วย: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  );

  if (hashSalt && hashSalt.length < 16) {
    add("error", "HASH_SALT สั้นเกินไป ต้องยาวอย่างน้อย 16 ตัวอักษร");
  }
  if (sessionSecret && sessionSecret.length < 32) {
    add("error", "SESSION_SECRET สั้นเกินไป ต้องยาวอย่างน้อย 32 ตัวอักษร");
  }

  if (siteUrl?.includes("localhost")) {
    add(
      "error",
      "NEXT_PUBLIC_SITE_URL ยังชี้ไปที่ localhost อยู่",
      "ลิงก์ในอีเมลและ QR จะพาผู้ลงทะเบียนไปที่เครื่องของตัวเอง ซึ่งเปิดไม่ได้",
    );
  } else if (siteUrl && !siteUrl.startsWith("https://")) {
    add(
      "error",
      "NEXT_PUBLIC_SITE_URL ไม่ใช่ https",
      "กล้องสแกน QR และ Service Worker ทำงานได้เฉพาะบน HTTPS เท่านั้น",
    );
  }

  // ---------- ② ค่าที่ควรมีก่อนเปิดใช้จริง ----------
  optional(
    "RESEND_API_KEY",
    "ถ้าไม่มี ระบบจะเขียนอีเมลลงหน้าจอเซิร์ฟเวอร์แทนการส่งจริง",
    "สมัครที่ resend.com แล้วยืนยันโดเมนผู้ส่งให้ครบ SPF + DKIM + DMARC",
  );
  optional("EMAIL_FROM", "ต้องเป็นโดเมนที่ยืนยันแล้วใน Resend", 'เช่น "TNN Event <noreply@tnn.co.th>"');
  optional(
    "CRON_SECRET",
    "ถ้าไม่มี งานกวาดที่นั่งค้างรายวันจะไม่ทำงาน (ไม่กระทบการตัดโควตา)",
    'สร้างด้วย: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"',
  );

  const r2Keys = [
    "R2_ACCOUNT_ID",
    "R2_BUCKET",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_PUBLIC_BASE_URL",
  ];
  const r2Missing = r2Keys.filter((key) => !process.env[key]);
  if (r2Missing.length === 0) {
    add("ok", "ตั้งค่าที่เก็บไฟล์ภาพ (Cloudflare R2) ครบแล้ว");
  } else if (r2Missing.length === r2Keys.length) {
    add(
      "error",
      "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ภาพเลย",
      "บน Vercel ระบบไฟล์เขียนไม่ได้ — ภาพที่อัปโหลดจะหายทุกครั้งที่ deploy",
    );
  } else {
    add("error", `ตั้งค่า R2 ไม่ครบ ขาด: ${r2Missing.join(", ")}`, "ต้องใส่ครบทั้ง 5 ตัวจึงจะทำงาน");
  }

  optional(
    "RECAPTCHA_SECRET_KEY",
    "ถ้าไม่มี ระบบจะข้ามการตรวจ bot ที่หน้าฟอร์ม",
    "สร้างคีย์ reCAPTCHA v3 ที่ google.com/recaptcha/admin",
  );

  // ---------- ③ ต่อฐานข้อมูลจริง ----------
  if (databaseUrl) {
    try {
      const { db } = await import("../src/db");

      const tables = await db.execute<{ count: number }>(sql`
        select count(*)::int as count
        from information_schema.tables
        where table_schema = 'public'
      `);
      const tableCount = Number(tables[0]?.count ?? 0);

      if (tableCount === 0) {
        add("error", "ต่อฐานข้อมูลได้ แต่ยังไม่มีตารางเลย", "รัน: npm run db:migrate");
      } else if (tableCount < 20) {
        add(
          "error",
          `มีตารางแค่ ${tableCount} จาก 20 ตาราง — migration ยังไม่ครบ`,
          "รัน: npm run db:migrate",
        );
      } else {
        add("ok", `ต่อฐานข้อมูลได้ และมีตารางครบ ${tableCount} ตาราง`);
      }

      const events = await db.execute<{ count: number }>(sql`select count(*)::int as count from events`);
      if (Number(events[0]?.count ?? 0) === 0) {
        add("warn", "ยังไม่มีงานในระบบ", "รัน npm run db:seed หรือสร้างงานจากหน้าตั้งค่า");
      } else {
        add("ok", "มีข้อมูลงานในระบบแล้ว");
      }

      const admins = await db.execute<{ count: number }>(sql`
        select count(*)::int as count from users
        where role = 'admin' and is_active = true and password_hash <> ''
      `);
      if (Number(admins[0]?.count ?? 0) === 0) {
        add(
          "error",
          "ไม่มีบัญชีผู้ดูแลที่ตั้งรหัสผ่านแล้ว — จะเข้าหลังบ้านไม่ได้เลย",
          "รัน: npm run user:password -- อีเมล รหัสผ่าน",
        );
      } else {
        add("ok", "มีบัญชีผู้ดูแลที่พร้อมใช้งาน");
      }
    } catch (error) {
      add(
        "error",
        `ต่อฐานข้อมูลไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
        "ตรวจ DATABASE_URL และตรวจว่าอนุญาตให้เชื่อมต่อจากภายนอกแล้ว",
      );
    }
  }

  // ---------- สรุปผล ----------
  const icon: Record<Level, string> = { ok: "✅", warn: "⚠️ ", error: "❌" };
  for (const result of results) {
    console.log(`${icon[result.level]} ${result.message}`);
    if (result.fix && result.level !== "ok") console.log(`     → ${result.fix}`);
  }

  const errors = results.filter((r) => r.level === "error").length;
  const warnings = results.filter((r) => r.level === "warn").length;

  console.log("");
  if (errors > 0) {
    console.log(`❌ ยังไม่พร้อม deploy — ต้องแก้ ${errors} ข้อ (มีคำเตือนอีก ${warnings} ข้อ)`);

    /**
     * ตอนตั้งค่าบนเครื่องตัวเอง ข้อที่ติดมักเป็น NEXT_PUBLIC_SITE_URL กับ R2
     * ซึ่งเป็นเรื่องปกติและยังไม่ต้องแก้ — บอกให้ชัดจะได้ไม่เข้าใจผิดว่าตั้งค่าผิด
     */
    if (siteUrl?.includes("localhost")) {
      console.log(
        "\nℹ️  ถ้ากำลังตั้งค่าบนเครื่องตัวเองอยู่ ข้อ NEXT_PUBLIC_SITE_URL และ R2 ยังไม่ต้องแก้\n" +
          "   ค่อยใส่ค่าจริงตอนตั้ง Environment Variables ใน Vercel\n" +
          "   ตอนนี้ดูแค่ 3 บรรทัดนี้พอ: ต่อฐานข้อมูลได้ · มีข้อมูลงาน · มีบัญชีผู้ดูแล",
      );
    }
    console.log("");
    process.exit(1);
  }
  console.log(
    warnings > 0
      ? `✅ พร้อม deploy — แต่มีคำเตือน ${warnings} ข้อที่ควรดูก่อนเปิดรับลงทะเบียนจริง\n`
      : "✅ พร้อม deploy ครบทุกข้อ\n",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
