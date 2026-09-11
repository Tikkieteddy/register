/**
 * ดูรายชื่อบัญชีเจ้าหน้าที่และผู้ดูแลทั้งหมดในฐานข้อมูล
 *
 * รันด้วย: npm run user:list
 *
 * ใช้ตอบคำถามว่า "ทำไมล็อกอินไม่ได้" ได้ในคำสั่งเดียว —
 * บอกว่ามีบัญชีอะไรบ้าง เป็นผู้ดูแลหรือเจ้าหน้าที่ ตั้งรหัสผ่านหรือยัง
 * บัญชีถูกปิดอยู่หรือเปล่า และถูกล็อกจากการกรอกรหัสผิดหรือไม่
 *
 * ⚠️ ไม่แสดงรหัสผ่านและแสดงไม่ได้ด้วย เพราะเก็บแบบเข้ารหัสทางเดียว
 *    ถ้าลืมรหัส ต้องตั้งใหม่ด้วย npm run user:password
 */
import "../src/lib/load-env";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลระบบ (เข้าหลังบ้านได้)",
  staff: "เจ้าหน้าที่หน้างาน (เข้าหลังบ้านไม่ได้)",
  viewer: "ดูอย่างเดียว (เข้าหลังบ้านไม่ได้)",
};

function describeDatabase(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "ฐานข้อมูลในเครื่องคุณเอง (ไม่ใช่ตัวจริงที่เว็บใช้)";
    }
    return host.includes("supabase")
      ? `Supabase — ฐานข้อมูลตัวจริงที่เว็บใช้งาน (${host})`
      : `ฐานข้อมูลภายนอก (${host})`;
  } catch {
    return "อ่านที่อยู่ฐานข้อมูลไม่ได้";
  }
}

async function main() {
  console.log(`\n👥 บัญชีทั้งหมดใน: ${describeDatabase()}\n`);

  const rows = await db
    .select({
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      canScan: users.canScan,
      isActive: users.isActive,
      passwordHash: users.passwordHash,
      lockedUntil: users.lockedUntil,
      failedLoginCount: users.failedLoginCount,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.email));

  if (rows.length === 0) {
    console.log("❌ ไม่มีบัญชีในฐานข้อมูลเลย");
    console.log("   ต้องสร้างบัญชีก่อนด้วย npm run db:seed\n");
    process.exit(1);
  }

  const now = new Date();
  let problems = 0;

  for (const u of rows) {
    const hasPassword = u.passwordHash.length > 0;
    const isLocked = u.lockedUntil !== null && u.lockedUntil > now;

    console.log(`─────────────────────────────────────────────`);
    console.log(`อีเมล      : ${u.email}`);
    console.log(`ชื่อ        : ${u.fullName}`);
    console.log(`สิทธิ์      : ${ROLE_LABEL[u.role] ?? u.role}`);
    console.log(`สแกน QR   : ${u.canScan ? "ได้" : "ไม่ได้"}`);
    console.log(`สถานะ     : ${u.isActive ? "✅ เปิดใช้งาน" : "❌ ถูกปิด — ล็อกอินไม่ได้"}`);
    console.log(
      `รหัสผ่าน   : ${hasPassword ? "✅ ตั้งแล้ว" : "❌ ยังไม่ได้ตั้ง — ล็อกอินไม่ได้"}`,
    );
    if (isLocked) {
      console.log(
        `การล็อก    : ❌ ถูกล็อกถึง ${u.lockedUntil?.toLocaleString("th-TH")} (กรอกผิด ${u.failedLoginCount} ครั้ง)`,
      );
    }
    console.log(
      `เข้าล่าสุด  : ${u.lastLoginAt ? u.lastLoginAt.toLocaleString("th-TH") : "ยังไม่เคยเข้า"}`,
    );

    if (!u.isActive || !hasPassword || isLocked) problems++;
  }
  console.log(`─────────────────────────────────────────────\n`);

  const admins = rows.filter((u) => u.role === "admin" && u.isActive && u.passwordHash.length > 0);
  if (admins.length === 0) {
    console.log("❌ ไม่มีบัญชีผู้ดูแลที่ใช้งานได้เลย — เข้าหน้า /admin ไม่ได้แน่นอน");
    console.log("   แก้ด้วย: npm run user:password -- <อีเมลผู้ดูแล> \"รหัสผ่านใหม่\"\n");
    process.exit(1);
  }

  console.log(`✅ มีบัญชีผู้ดูแลที่ใช้งานได้ ${admins.length} บัญชี:`);
  for (const a of admins) console.log(`   · ${a.email}`);

  if (problems > 0) {
    console.log(`\n⚠️ มี ${problems} บัญชีที่ล็อกอินไม่ได้ ดูสาเหตุด้านบน`);
  }
  console.log(
    "\nℹ️ ถ้าล็อกอินด้วยบัญชีเหล่านี้แล้วยังเข้า /admin ไม่ได้ ให้ลองล้างคุกกี้ในเบราว์เซอร์แล้วล็อกอินใหม่\n",
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("\n❌ ต่อฐานข้อมูลไม่ได้");
  console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
