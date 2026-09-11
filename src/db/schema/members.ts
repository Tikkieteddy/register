import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * ตารางสมาชิก — คนทั่วไปที่สมัครไว้ล่วงหน้าเพื่อไม่ต้องกรอกข้อมูลซ้ำทุกงาน
 *
 * ⚠️ แยกจากตาราง users โดยตั้งใจ ห้ามเอามารวมกัน
 *
 *    users = เจ้าหน้าที่และผู้ดูแล มีรหัสผ่าน เข้าหลังบ้านได้
 *    members = ผู้เข้าร่วมงานทั่วไป ไม่มีรหัสผ่าน เข้าหลังบ้านไม่ได้เด็ดขาด
 *
 *    ถ้าเอามารวมกันแล้ววันหนึ่งเผลอตั้ง role ผิด คนนอกจะเข้าหลังบ้านได้ทันที
 *    การแยกตารางทำให้ความผิดพลาดแบบนั้นเกิดไม่ได้ตั้งแต่ระดับโครงสร้าง
 */
export const members = pgTable(
  "members",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    /** บังคับกรอก — ใช้ออกบัตรเข้างานและยืนยันตัวตนหน้างาน */
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    /** เก็บเป็นตัวพิมพ์เล็กเสมอ เพื่อให้ตรวจซ้ำได้ถูกต้อง */
    email: varchar("email", { length: 255 }).notNull(),

    /** ไม่บังคับ — กรอกเพิ่มได้เพื่อความสะดวกตอนสมัครงาน */
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    /** ที่อยู่ของรูปโปรไฟล์ — ว่างได้ และจะว่างเสมอถ้ายังไม่ได้ตั้งค่าที่เก็บไฟล์ */
    photoUrl: text("photo_url"),

    /** แฮชแล้วเท่านั้น ห้ามเก็บ IP ดิบ (PDPA) */
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    /** เวอร์ชันนโยบายที่สมาชิกยินยอม ณ วันที่สมัคร — ใช้เป็นหลักฐานตาม PDPA */
    policyVersion: varchar("policy_version", { length: 20 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** หนึ่งอีเมลสมัครสมาชิกได้ครั้งเดียว */
    uniqueIndex("members_email_uq").on(t.email),
    index("members_created_idx").on(t.createdAt),
  ],
);
