/**
 * สร้างข้อมูลตัวอย่างสำหรับทดสอบหน้า Dashboard และหลังบ้าน
 *
 * ⚠️ สำหรับเครื่องพัฒนาเท่านั้น — ห้ามรันกับฐานข้อมูลจริงเด็ดขาด
 *    สคริปต์นี้จะปฏิเสธการทำงานถ้า NODE_ENV = production
 *
 * รันด้วย: npm run db:demo
 */
// โหลด .env.local ก่อนทุกอย่าง เพราะสคริปต์นี้รันนอก Next.js
import "../src/lib/load-env";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  checkIns,
  consents,
  emailLogs,
  eventSessions,
  events,
  formOptions,
  formQuestions,
  linkEvents,
  registrationAnswers,
  registrationSessions,
  registrations,
  shareLinks,
  tickets,
} from "../src/db/schema";
import { generateRegistrationCode, generateTicketCode } from "../src/lib/codes";
import { hashIdentifier } from "../src/lib/hash";

if (process.env.NODE_ENV === "production") {
  throw new Error("ห้ามรันสคริปต์ข้อมูลตัวอย่างกับฐานข้อมูลจริง");
}

const FIRST = ["สมชาย", "สมหญิง", "ปรีชา", "วิภา", "ธนกร", "ณัฐพร", "อรุณี", "กิตติ", "พิมพ์ใจ", "ศิริพร"];
const LAST = ["ใจดี", "รักงาน", "มีสุข", "ตั้งใจ", "ศรีสุข", "วงศ์ทอง", "แสงทอง", "บุญมา"];
const OCCUPATIONS = ["พนักงานบริษัท", "ข้าราชการ", "นักเรียน/นักศึกษา", "ธุรกิจส่วนตัว", "อื่นๆ"];

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]!;
}

async function main() {
  const [event] = await db.select().from(events).orderBy(sql`starts_at desc`).limit(1);
  if (!event) throw new Error("ยังไม่มีงานในระบบ — รัน npm run db:seed ก่อน");

  const sessions = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(eventSessions.sortOrder);

  const links = await db.select().from(shareLinks).where(eq(shareLinks.eventId, event.id));

  const questions = await db
    .select()
    .from(formQuestions)
    .where(eq(formQuestions.eventId, event.id));

  const options = await db.select().from(formOptions);

  const TOTAL = 120;
  const now = Date.now();
  let created = 0;

  for (let i = 0; i < TOTAL; i++) {
    // กระจายวันลงทะเบียนย้อนหลัง 14 วัน โดยให้พีคช่วงกลาง เหมือนงานจริงที่ยอดพุ่งหลังโพสต์
    const daysAgo = 14 - Math.floor(Math.abs(Math.sin(i * 1.7)) * 14);
    const createdAt = new Date(now - daysAgo * 86_400_000 - (i % 24) * 3_600_000);

    const code = generateRegistrationCode();
    const email = `demo${i}.${code.toLowerCase()}@example.com`;
    const link = links.length > 0 ? pick(links, i) : null;

    const chosen =
      i % 5 === 0 ? sessions : i % 2 === 0 ? sessions.slice(0, 1) : sessions.slice(-1);
    if (chosen.length === 0) continue;

    const [registration] = await db
      .insert(registrations)
      .values({
        eventId: event.id,
        registrationCode: code,
        firstName: pick(FIRST, i),
        lastName: pick(LAST, i * 3),
        email,
        phone: `08${String(10_000_000 + i * 137).slice(0, 8)}`,
        occupation: pick(OCCUPATIONS, i * 2),
        status: i % 23 === 0 ? "cancelled" : "confirmed",
        source: i % 11 === 0 ? "walkin" : "online",
        shareLinkId: link?.id ?? null,
        utmSource: link?.channel ?? null,
        utmMedium: link?.medium ?? null,
        utmCampaign: link?.campaign ?? null,
        ipHash: hashIdentifier(`203.0.113.${i % 254}`),
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: registrations.id });

    if (!registration) continue;
    created += 1;

    await db
      .insert(registrationSessions)
      .values(chosen.map((s) => ({ registrationId: registration.id, sessionId: s.id, createdAt })));

    for (const s of chosen) {
      await db
        .update(eventSessions)
        .set({ reservedCount: sql`${eventSessions.reservedCount} + 1` })
        .where(eq(eventSessions.id, s.id));
    }

    const ticketCode = generateTicketCode(code);
    const [ticket] = await db
      .insert(tickets)
      .values({
        registrationId: registration.id,
        ticketCode,
        holderFirstName: pick(FIRST, i),
        holderLastName: pick(LAST, i * 3),
        holderEmail: email,
        status: i % 23 === 0 ? "void" : "valid",
        issuedAt: createdAt,
        createdAt,
      })
      .returning({ id: tickets.id });

    await db.insert(consents).values({
      registrationId: registration.id,
      type: "pdpa",
      isGranted: true,
      policyVersion: event.privacyPolicyVersion,
      consentedAt: createdAt,
    });

    // คำตอบของคำถามในฟอร์ม เพื่อให้กราฟที่ 4 และ 5 มีข้อมูล
    for (const q of questions) {
      const opts = options.filter((o) => o.questionId === q.id);
      if (opts.length === 0) continue;
      const takeCount = q.type === "checkbox" ? 1 + (i % 3) : 1;
      for (let k = 0; k < takeCount; k++) {
        const opt = pick(opts, i * 5 + k * 3);
        await db
          .insert(registrationAnswers)
          .values({ registrationId: registration.id, questionId: q.id, optionId: opt.id, createdAt })
          .onConflictDoNothing();
      }
    }

    // ประวัติอีเมล — ให้มีที่ส่งไม่สำเร็จปนอยู่บ้าง เพื่อทดสอบหน้าจัดการอีเมล
    await db.insert(emailLogs).values({
      registrationId: registration.id,
      toEmail: email,
      template: "confirmation",
      provider: "demo",
      status: i % 17 === 0 ? "failed" : i % 29 === 0 ? "bounced" : "sent",
      attemptCount: i % 17 === 0 ? 3 : 1,
      lastError: i % 17 === 0 ? "550 mailbox unavailable" : null,
      sentAt: i % 17 === 0 ? null : createdAt,
      createdAt,
    });

    // เช็คอินประมาณ 62% ของคนที่ยืนยันแล้ว กระจายตามชั่วโมงจริงหน้างาน
    if (ticket && i % 23 !== 0 && i % 8 !== 0 && i % 13 !== 0) {
      for (const s of chosen) {
        // ตั้งเวลาเป็น UTC โดยหักโซนเวลาไทยออก 7 ชั่วโมง
        // เพื่อให้กราฟที่แปลงกลับเป็นเวลาไทยแสดงช่วง 08:00–12:00 น. เหมือนหน้างานจริง
        const hourBangkok = 8 + (i % 5);
        const checkedInAt = new Date(s.startsAt);
        checkedInAt.setUTCHours(hourBangkok - 7, (i * 7) % 60, 0, 0);
        await db
          .insert(checkIns)
          .values({
            ticketId: ticket.id,
            sessionId: s.id,
            checkedInAt,
            method: i % 6 === 0 ? "search" : "qr",
            isOfflineSync: i % 19 === 0,
          })
          .onConflictDoNothing();
        await db
          .update(eventSessions)
          .set({ checkedInCount: sql`${eventSessions.checkedInCount} + 1` })
          .where(eq(eventSessions.id, s.id));
      }
    }

    // เหตุการณ์ของลิงก์ — คลิกมากกว่าลงทะเบียนเสมอ เหมือนของจริง
    if (link) {
      const clicks = 2 + (i % 4);
      for (let c = 0; c < clicks; c++) {
        await db.insert(linkEvents).values({
          eventId: event.id,
          shareLinkId: link.id,
          action: c === 0 ? "view_form" : "click",
          visitorHash: hashIdentifier(`visitor-${i}-${c % 2}`),
          deviceType: c % 3 === 0 ? "desktop" : "mobile",
          createdAt,
        });
      }
      await db
        .update(shareLinks)
        .set({
          clickCount: sql`${shareLinks.clickCount} + ${clicks - 1}`,
          conversionCount: sql`${shareLinks.conversionCount} + 1`,
        })
        .where(eq(shareLinks.id, link.id));
    }

    // การกดปุ่มแชร์
    if (i % 4 === 0) {
      const platforms = ["facebook", "line", "x", "copy"] as const;
      // หาร 4 ก่อน เพราะเงื่อนไขข้างบนทำให้ i เป็นพหุคูณของ 4 เสมอ
      // ถ้าใช้ i ตรง ๆ จะได้แพลตฟอร์มเดิมทุกครั้ง
      const platform = pick(platforms, i / 4);
      await db.insert(linkEvents).values({
        eventId: event.id,
        shareLinkId: link?.id ?? null,
        action: platform === "copy" ? "copy_link" : "share",
        platform,
        sourcePage: i % 8 === 0 ? "thankyou" : "landing",
        createdAt,
      });
    }
  }

  console.log(`✅ สร้างข้อมูลตัวอย่าง ${created} รายการสำหรับงาน "${event.nameTh}"`);
  console.log("   ⚠️ ข้อมูลนี้เป็นข้อมูลสมมติทั้งหมด ต้องล้างก่อนเปิดใช้งานจริง");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
