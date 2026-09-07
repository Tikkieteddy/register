"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit";
import { sendConfirmationEmail } from "@/lib/email/confirmation";
import { isEmailConfigured, sendWithRetry } from "@/lib/email/sender";

export type EmailActionResult = { ok: boolean; message: string };

/**
 * ส่งซ้ำทุกฉบับที่ค้างอยู่ (หัวข้อ 3.6)
 *
 * ⚠️ จำกัดจำนวนต่อครั้งไว้ เพราะการยิงอีเมลหลายพันฉบับรวดเดียว
 *    จะโดนผู้ให้บริการจำกัดอัตราแล้วล้มทั้งชุด
 */
const MAX_PER_BATCH = 100;

export async function resendAllFailedAction(eventId: string): Promise<EmailActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const rows = await db.execute<{ registration_id: string }>(sql`
    select distinct el.registration_id
    from email_logs el
    join registrations r on r.id = el.registration_id
    where r.event_id = ${eventId}
      and el.status in ('failed', 'bounced')
      and r.status <> 'cancelled'
    limit ${MAX_PER_BATCH}
  `);

  if (rows.length === 0) {
    return { ok: true, message: "ไม่มีอีเมลที่ค้างส่ง — ทุกฉบับส่งสำเร็จแล้ว" };
  }

  let sent = 0;
  for (const row of rows) {
    if (!row.registration_id) continue;
    const result = await sendConfirmationEmail(row.registration_id);
    if (result?.sent) sent += 1;
  }

  await recordAudit({
    userId: admin.id,
    action: "resend_email",
    entityType: "email_batch",
    entityId: eventId,
    after: { attempted: rows.length, sent },
  });

  revalidatePath("/admin/emails");
  return {
    ok: sent > 0,
    message:
      sent === rows.length
        ? `ส่งซ้ำสำเร็จครบ ${sent} ฉบับ`
        : `ส่งสำเร็จ ${sent} จาก ${rows.length} ฉบับ — ที่เหลือดูสาเหตุในตารางด้านล่าง`,
  };
}

/**
 * ส่งอีเมลทดสอบหาตัวเอง (หัวข้อ 3.6)
 *
 * ⚠️ ต้องกดปุ่มนี้และตรวจว่าอีเมลไม่ตกถัง Junk ก่อนเปิดรับลงทะเบียนจริงเสมอ
 *    ถ้าตก แปลว่า SPF / DKIM / DMARC ยังตั้งไม่ครบ
 */
export async function sendTestEmailAction(toEmail: string): Promise<EmailActionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  if (!isEmailConfigured()) {
    return {
      ok: false,
      message:
        "ยังไม่ได้ตั้งค่าบริการส่งอีเมล — ต้องใส่ RESEND_API_KEY และ EMAIL_FROM ก่อน จึงจะส่งได้จริง",
    };
  }

  const target = toEmail.trim().toLowerCase() || admin.email;

  const result = await sendWithRetry({
    registrationId: null,
    template: "test",
    message: {
      to: target,
      subject: "[ทดสอบ] ระบบรับลงทะเบียนส่งอีเมลได้ปกติ",
      html: `<!doctype html><html lang="th"><body style="font-family:Tahoma,sans-serif;padding:24px">
<h1 style="color:#EC5F27;font-size:18px">อีเมลทดสอบจากระบบรับลงทะเบียน</h1>
<p>ถ้าคุณเห็นข้อความนี้ในกล่องจดหมายหลัก แปลว่าการตั้งค่าการส่งอีเมลถูกต้องแล้ว</p>
<p><strong>สิ่งที่ต้องตรวจต่อ:</strong> ถ้าอีเมลนี้ไปอยู่ในถัง Junk หรือ Spam
แปลว่า SPF / DKIM / DMARC ของโดเมนผู้ส่งยังตั้งไม่ครบ ต้องแก้ก่อนเปิดรับลงทะเบียนจริง</p>
<p style="color:#857a71;font-size:12px">ส่งโดย ${admin.fullName} เมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
</body></html>`,
      text:
        "อีเมลทดสอบจากระบบรับลงทะเบียน\n\n" +
        "ถ้าคุณเห็นข้อความนี้ในกล่องจดหมายหลัก แปลว่าการตั้งค่าถูกต้องแล้ว\n" +
        "ถ้าอยู่ในถัง Junk แปลว่า SPF / DKIM / DMARC ยังตั้งไม่ครบ",
    },
  });

  await recordAudit({
    userId: admin.id,
    action: "test_email",
    entityType: "email",
    entityId: String(result.logId),
    after: { to: target, sent: result.sent },
  });

  if (result.sent) {
    return {
      ok: true,
      message: `ส่งอีเมลทดสอบไปที่ ${target} แล้ว — ไปตรวจทั้งกล่องจดหมายหลักและถัง Junk`,
    };
  }

  // ดึงสาเหตุจริงจาก log มาบอกผู้ใช้ แทนที่จะบอกแค่ว่า "ส่งไม่สำเร็จ"
  const [failed] = await db.execute<{ last_error: string | null }>(sql`
    select last_error from email_logs where id = ${result.logId}
  `);

  return {
    ok: false,
    message: `ส่งไม่สำเร็จ: ${failed?.last_error ?? "ไม่ทราบสาเหตุ"}`,
  };
}
