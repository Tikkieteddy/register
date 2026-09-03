import {
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { linkActionEnum } from "./enums";
import { events } from "./events";

/**
 * ตารางที่ 18 — ลิงก์ติดตามผล (หัวข้อ 8.5)
 *
 * ⚠️ ต้องสร้างลิงก์ก่อนเริ่มโปรโมท เพราะเก็บข้อมูลย้อนหลังไม่ได้
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** ส่วนท้ายของลิงก์สั้น เช่น fb01 → /r/fb01 */
    code: varchar("code", { length: 20 }).notNull(),
    /** ชื่อที่ Admin ตั้งเอง เช่น "โพสต์ Facebook วันที่ 1" */
    label: varchar("label", { length: 120 }).notNull(),

    channel: varchar("channel", { length: 80 }),
    medium: varchar("medium", { length: 80 }),
    campaign: varchar("campaign", { length: 80 }),
    /** ปลายทาง ปกติคือหน้ารายละเอียดงาน */
    targetPath: text("target_path").notNull().default("/"),
    /** QR ที่ระบบสร้างให้อัตโนมัติ ดาวน์โหลดไปใช้ในสื่อสิ่งพิมพ์ได้ */
    qrImageUrl: text("qr_image_url"),

    /** นับสะสมไว้เพื่อความเร็วของ Dashboard (คำนวณจาก link_events อีกที) */
    clickCount: integer("click_count").notNull().default(0),
    uniqueCount: integer("unique_count").notNull().default(0),
    conversionCount: integer("conversion_count").notNull().default(0),

    /** ปิดลิงก์ได้โดยไม่ต้องลบ เพื่อรักษาสถิติเดิมไว้ */
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("share_links_code_uq").on(t.code),
    index("share_links_event_idx").on(t.eventId, t.isActive),
  ],
);

/** ตารางที่ 19 — เหตุการณ์ที่เกิดกับลิงก์ (คลิก / เข้าหน้าฟอร์ม / แชร์ / คัดลอกลิงก์) */
export const linkEvents = pgTable(
  "link_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    shareLinkId: uuid("share_link_id").references(() => shareLinks.id, { onDelete: "set null" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    action: linkActionEnum("action").notNull(),
    /** facebook | line | x | copy — เฉพาะ action = share */
    platform: varchar("platform", { length: 40 }),
    /** แชร์จากหน้าไหน — landing | thankyou */
    sourcePage: varchar("source_page", { length: 60 }),

    /** ใครเป็นคนแชร์ต่อ — ใช้วัดว่าการบอกต่อของผู้ลงทะเบียนพาคนมาได้จริงแค่ไหน */
    sharerRegistrationId: uuid("sharer_registration_id"),

    /** นับผู้ใช้ไม่ซ้ำโดยไม่ระบุตัวตน */
    visitorHash: varchar("visitor_hash", { length: 64 }),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    deviceType: varchar("device_type", { length: 20 }),
    country: varchar("country", { length: 2 }),
    /** ⚠️ แฮชแล้วเท่านั้น ห้ามเก็บ IP ดิบ (PDPA) */
    ipHash: varchar("ip_hash", { length: 64 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("link_events_link_time_idx").on(t.shareLinkId, t.createdAt),
    index("link_events_action_time_idx").on(t.action, t.createdAt),
    index("link_events_visitor_idx").on(t.visitorHash),
    index("link_events_event_idx").on(t.eventId, t.createdAt),
  ],
);
