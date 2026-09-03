/**
 * ข้อมูลตัวอย่างสำหรับทดสอบระบบ
 *
 * รันด้วย: npm run db:seed
 * ⚠️ สคริปต์นี้ลบข้อมูลของงานที่มี slug เดียวกันทิ้งก่อนเสมอ — ห้ามรันบน production
 *
 * ค่าที่ใช้เป็นค่า default ตามคำตอบคำถาม Q5–Q10 และ Q24 ในเอกสาร
 * แก้ได้ทั้งหมดจากหลังบ้านภายหลัง โดยไม่ต้องแก้โค้ด
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  eventSessions,
  events,
  formOptions,
  formQuestions,
  shareLinks,
  users,
} from "./schema";

const EVENT_SLUG = "tnn-event-2026";

/** ตัวเลือกอาชีพ — ค่า default ตามคำตอบ Q10 */
const OCCUPATIONS = [
  "นักเรียน / นักศึกษา",
  "พนักงานบริษัทเอกชน",
  "ข้าราชการ / รัฐวิสาหกิจ",
  "ธุรกิจส่วนตัว",
  "รับจ้างทั่วไป",
  "เกษียณอายุ",
];

/** ช่องทางที่ทราบข่าว — ตามข้อกำหนด A1 */
const HEAR_FROM = [
  "Facebook",
  "TikTok",
  "YouTube",
  "ทีวี TNN",
  "เพื่อน / คนรู้จัก",
  "อีเมล / จดหมายเชิญ",
];

/** รายการ TNN — ค่าตัวอย่างตามคำตอบ Q9 รอข้อมูลจริงจากผู้จัดงาน */
const TNN_PROGRAMS = [
  "TNN ข่าวเช้า",
  "TNN ข่าวเที่ยง",
  "TNN ข่าวค่ำ",
  "เศรษฐกิจติดจอ",
  "TNN Exclusive",
  "ชีพจรโลก",
  "TNN Tech Reports",
  "สนามข่าวชุมชน",
];

/** ลิงก์ติดตามผล 6 ช่องทาง — ค่า default ตามคำตอบ Q24 */
const SHARE_LINKS = [
  { code: "fb01", label: "โพสต์ Facebook", channel: "facebook", medium: "social" },
  { code: "tt01", label: "TikTok", channel: "tiktok", medium: "social" },
  { code: "yt01", label: "YouTube", channel: "youtube", medium: "social" },
  { code: "tv", label: "QR ขึ้นจอทีวี TNN", channel: "tv", medium: "broadcast" },
  { code: "mail", label: "อีเมลเชิญ", channel: "email", medium: "email" },
  { code: "line", label: "LINE OA", channel: "line", medium: "social" },
];

async function seed() {
  console.log("🌱 เริ่มใส่ข้อมูลตัวอย่าง...");

  const existing = await db.select({ id: events.id }).from(events).where(eq(events.slug, EVENT_SLUG));
  if (existing.length > 0 && existing[0]) {
    console.log("   ลบข้อมูลงานเดิมที่มี slug เดียวกันทิ้งก่อน");
    await db.delete(events).where(eq(events.id, existing[0].id));
  }

  // ---------- งาน ----------
  const [event] = await db
    .insert(events)
    .values({
      slug: EVENT_SLUG,
      nameTh: "TNN Event 2026",
      nameEn: "TNN Event 2026",
      descriptionTh: "งานตัวอย่างสำหรับทดสอบระบบ — ข้อมูลจริงรอจากผู้จัดงาน",
      category: "สัมมนา",
      venueName: "[รอข้อมูลสถานที่จริง]",
      venueAddress: "[รอที่อยู่เต็ม]",
      startsAt: new Date("2026-12-01T02:00:00Z"), // 09:00 น. เวลาไทย
      endsAt: new Date("2026-12-01T09:30:00Z"), // 16:30 น. เวลาไทย
      registrationOpensAt: new Date("2026-10-01T00:00:00Z"),
      registrationClosesAt: new Date("2026-11-25T17:00:00Z"),
      status: "draft",
      organizerName: "TNN",
    })
    .returning();

  if (!event) throw new Error("สร้างงานตัวอย่างไม่สำเร็จ");
  console.log(`   ✓ สร้างงาน "${event.nameTh}"`);

  // ---------- ช่วงเวลา (โควตาตามคำตอบ Q7) ----------
  await db.insert(eventSessions).values([
    {
      eventId: event.id,
      code: "morning",
      nameTh: "ภาคเช้า",
      nameEn: "Morning",
      startsAt: new Date("2026-12-01T02:00:00Z"),
      endsAt: new Date("2026-12-01T05:00:00Z"),
      quota: 250,
      sortOrder: 1,
    },
    {
      eventId: event.id,
      code: "afternoon",
      nameTh: "ภาคบ่าย",
      nameEn: "Afternoon",
      startsAt: new Date("2026-12-01T06:00:00Z"),
      endsAt: new Date("2026-12-01T09:30:00Z"),
      quota: 250,
      sortOrder: 2,
    },
  ]);
  console.log("   ✓ สร้างช่วงเวลา ภาคเช้า 250 ที่นั่ง / ภาคบ่าย 250 ที่นั่ง");

  // ---------- คำถามในฟอร์ม ----------
  async function addQuestion(
    q: typeof formQuestions.$inferInsert,
    labels: string[],
    hasOther: boolean,
  ) {
    const [row] = await db.insert(formQuestions).values(q).returning();
    if (!row) throw new Error(`สร้างคำถาม ${q.key} ไม่สำเร็จ`);

    const options = labels.map((labelTh, i) => ({
      questionId: row.id,
      value: `opt_${i + 1}`,
      labelTh,
      sortOrder: i + 1,
      isOther: false,
    }));
    if (hasOther) {
      options.push({
        questionId: row.id,
        value: "other",
        labelTh: "อื่นๆ (โปรดระบุ)",
        sortOrder: labels.length + 1,
        isOther: true,
      });
    }
    await db.insert(formOptions).values(options);
  }

  await addQuestion(
    {
      eventId: event.id,
      key: "occupation",
      labelTh: "อาชีพ",
      type: "dropdown",
      isRequired: true,
      hasOtherOption: true,
      sortOrder: 1,
    },
    OCCUPATIONS,
    true,
  );

  await addQuestion(
    {
      eventId: event.id,
      key: "hear_from",
      labelTh: "ทราบข้อมูล event นี้จากทางไหน",
      type: "checkbox",
      isRequired: true,
      minSelect: 1,
      hasOtherOption: true,
      sortOrder: 2,
    },
    HEAR_FROM,
    true,
  );

  await addQuestion(
    {
      eventId: event.id,
      key: "favorite_tnn_program",
      labelTh: "ชื่นชอบรายการใดของ TNN",
      helperTextTh: "(เลือกได้ไม่เกิน 3 รายการ)",
      type: "checkbox",
      isRequired: true,
      minSelect: 1,
      maxSelect: 3,
      hasOtherOption: true,
      sortOrder: 3,
    },
    TNN_PROGRAMS,
    true,
  );
  console.log("   ✓ สร้างคำถามในฟอร์ม 3 ข้อ พร้อมตัวเลือก");

  // ---------- ลิงก์ติดตามผล ----------
  await db.insert(shareLinks).values(
    SHARE_LINKS.map((l) => ({
      eventId: event.id,
      code: l.code,
      label: l.label,
      channel: l.channel,
      medium: l.medium,
      campaign: EVENT_SLUG,
      targetPath: `/e/${EVENT_SLUG}`,
    })),
  );
  console.log(`   ✓ สร้างลิงก์ติดตามผล ${SHARE_LINKS.length} ช่องทาง`);

  // ---------- บัญชีผู้ใช้ตัวอย่าง ----------
  // ⚠️ passwordHash เป็นค่าว่างไว้ก่อน — ระบบล็อกอินจริงจะทำในเฟส 4
  //    ตอนนั้นจะสร้างสคริปต์ตั้งรหัสผ่านที่แฮชด้วย argon2 ให้
  await db.insert(users).values([
    {
      email: "admin@example.com",
      passwordHash: "",
      fullName: "ผู้ดูแลระบบ (ตัวอย่าง)",
      role: "admin",
      canScan: true,
    },
    {
      email: "staff@example.com",
      passwordHash: "",
      fullName: "เจ้าหน้าที่หน้างาน (ตัวอย่าง)",
      role: "staff",
      canScan: true,
    },
  ]);
  console.log("   ✓ สร้างบัญชีตัวอย่าง admin@example.com และ staff@example.com");

  console.log("\n✅ ใส่ข้อมูลตัวอย่างเรียบร้อย");
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("\n❌ ใส่ข้อมูลตัวอย่างไม่สำเร็จ:", error);
    process.exit(1);
  });
