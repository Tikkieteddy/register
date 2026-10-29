import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { getAdminOrNull } from "@/lib/admin/guard";
import { isEmailConfigured } from "@/lib/email/sender";
import { isStorageConfigured, missingStorageKeys } from "@/lib/storage";

/**
 * ตรวจสุขภาพระบบ — ใช้เฝ้าระวังตอนงานกำลังดำเนินอยู่
 *
 * มีสองระดับโดยตั้งใจ:
 *
 *   ① เรียกแบบไม่ล็อกอิน → ตอบแค่ว่าระบบยังทำงานอยู่หรือไม่
 *      ใช้กับบริการเฝ้าระวังภายนอก (เช่น UptimeRobot) ที่ตั้งให้เรียกทุก 5 นาที
 *      แล้วส่งข้อความเตือนเมื่อได้รหัส 503 — จะได้รู้ตัวก่อนที่ผู้ลงทะเบียนจะโทรมาบอก
 *
 *   ② เรียกโดยผู้ดูแลที่ล็อกอินแล้ว → บอกรายละเอียดว่าส่วนไหนพร้อม ส่วนไหนยังไม่พร้อม
 *
 * ⚠️ ห้ามเปิดเผยรายละเอียดให้คนที่ไม่ได้ล็อกอินเด็ดขาด
 *    การบอกคนนอกว่า "ระบบอีเมลยังไม่ได้ตั้งค่า" หรือ "ฐานข้อมูลล่ม"
 *    คือการบอกจุดอ่อนให้คนที่อยากโจมตีฟรี ๆ
 */

export const dynamic = "force-dynamic";

type Status = "ok" | "degraded" | "down";

export async function GET() {
  const startedAt = Date.now();
  const admin = await getAdminOrNull();

  /** ฐานข้อมูลคือหัวใจ — ถ้าต่อไม่ได้ถือว่าระบบล่ม ไม่ใช่แค่ทำงานได้ไม่เต็มที่ */
  let dbOk = false;
  let dbMs = 0;
  try {
    const t0 = Date.now();
    await db.execute(sql`select 1`);
    dbMs = Date.now() - t0;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const emailReady = isEmailConfigured();
  const storageReady = isStorageConfigured();
  const storageMissing = missingStorageKeys();

  const status: Status = !dbOk ? "down" : emailReady ? "ok" : "degraded";
  const httpStatus = status === "down" ? 503 : 200;

  // คนนอก: บอกแค่สถานะ ไม่บอกว่าอะไรพัง
  if (!admin) {
    return NextResponse.json(
      { status: status === "down" ? "down" : "ok", checkedAt: new Date().toISOString() },
      { status: httpStatus, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ผู้ดูแล: บอกครบว่าอะไรพร้อม อะไรยังไม่พร้อม และต้องทำอะไรต่อ
  const detail = {
    status,
    checkedAt: new Date().toISOString(),
    responseMs: Date.now() - startedAt,
    checks: {
      ฐานข้อมูล: dbOk
        ? { ok: true, note: `ตอบใน ${dbMs} มิลลิวินาที` }
        : { ok: false, note: "ต่อฐานข้อมูลไม่ได้ — ระบบรับลงทะเบียนไม่ได้เลย", fix: "ตรวจ DATABASE_URL และสถานะของ Supabase" },
      ระบบส่งอีเมล: emailReady
        ? { ok: true, note: "ตั้งค่าแล้ว พร้อมส่งอีเมลจริง" }
        : { ok: false, note: "ยังไม่ได้ตั้งค่า — ผู้ลงทะเบียนจะไม่ได้รับ QR ทางอีเมล", fix: "ตั้งค่า RESEND_API_KEY และ EMAIL_FROM" },
      ที่เก็บไฟล์ภาพ: storageReady
        ? { ok: true, note: "ตั้งค่าแล้ว อัปโหลดภาพได้" }
        : {
            ok: false,
            note: "ยังไม่ได้ตั้งค่า — อัปโหลดภาพบนเครื่องจริงไม่ได้",
            /**
             * บอกชื่อตัวแปรที่ขาดไปตรง ๆ ไม่ใช่ลิสต์ทั้ง 5 ตัวให้ไปไล่เดาเอง
             * (บอกแค่ชื่อ ไม่บอกค่า เพราะสองในห้าตัวเป็นกุญแจลับ)
             */
            ขาดตัวแปร: storageMissing,
            fix:
              storageMissing.length > 0
                ? `ตั้งค่าตัวแปรที่ขาดบน Vercel แล้วสั่ง Redeploy: ${storageMissing.join(", ")}`
                : "ตั้งค่าครบแล้วแต่ยังใช้ไม่ได้ — ตรวจว่าค่าถูกต้องและสั่ง Redeploy แล้วหรือยัง",
          },
      งานเก็บกวาดรายวัน: process.env.CRON_SECRET
        ? { ok: true, note: "ตั้งค่าแล้ว — คืนที่นั่งค้างและลบข้อมูลหมดอายุอัตโนมัติ" }
        : { ok: false, note: "ยังไม่ได้ตั้งค่า CRON_SECRET — งานรายวันจะไม่ทำงาน", fix: "ตั้งค่า CRON_SECRET บน Vercel" },
    },
  };

  return NextResponse.json(detail, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
