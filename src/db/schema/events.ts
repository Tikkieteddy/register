import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { eventStatusEnum, questionTypeEnum } from "./enums";

/** ตารางที่ 1 — ข้อมูลงาน */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** ใช้ทำ URL เช่น /e/tnn-expo-2026 */
    slug: varchar("slug", { length: 80 }).notNull(),
    nameTh: varchar("name_th", { length: 200 }).notNull(),
    nameEn: varchar("name_en", { length: 200 }),
    descriptionTh: text("description_th"),
    descriptionEn: text("description_en"),
    category: varchar("category", { length: 60 }),

    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    venueLat: numeric("venue_lat", { precision: 10, scale: 7 }),
    venueLng: numeric("venue_lng", { precision: 10, scale: 7 }),
    mapUrl: text("map_url"),
    travelNote: text("travel_note"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 40 }).notNull().default("Asia/Bangkok"),

    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),

    status: eventStatusEnum("status").notNull().default("draft"),
    /** อนุญาตให้เจ้าหน้าที่ลงทะเบียน walk-in เกินโควตาได้หรือไม่ (หน้างานจริงมักต้องยืดหยุ่น) */
    allowWalkinOverQuota: boolean("allow_walkin_over_quota").notNull().default(true),
    /** เปิดรายชื่อสำรองเมื่อที่นั่งเต็ม (Q18) */
    waitlistEnabled: boolean("waitlist_enabled").notNull().default(true),
    /** นาทีที่จองที่นั่งชั่วคราวระหว่างกรอกฟอร์ม — ค่าเริ่มต้น 15 นาทีตามข้อกำหนด D3 */
    seatHoldMinutes: integer("seat_hold_minutes").notNull().default(15),

    themeColor: varchar("theme_color", { length: 7 }).notNull().default("#EC5F27"),

    organizerName: varchar("organizer_name", { length: 200 }),
    organizerPhone: varchar("organizer_phone", { length: 40 }),
    organizerEmail: varchar("organizer_email", { length: 255 }),
    organizerLineId: varchar("organizer_line_id", { length: 80 }),

    /** ใช้อ้างอิงตอนบันทึกหลักฐานความยินยอม (PDPA) */
    privacyPolicyVersion: varchar("privacy_policy_version", { length: 20 })
      .notNull()
      .default("1.0"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("events_slug_uq").on(t.slug),
    index("events_status_idx").on(t.status),
  ],
);

/**
 * ตารางที่ 2 — ช่วงเวลาของงาน (ภาคเช้า / ภาคบ่าย)
 *
 * ⚠️ จุดสำคัญที่สุดของทั้งระบบ: การบวก reservedCount ต้องทำใน transaction
 * พร้อม SELECT ... FOR UPDATE เสมอ ไม่งั้นตอนคนกดพร้อมกัน 300 คนจะเกิด
 * race condition และรับลงทะเบียนเกินโควตา — ดู src/lib/quota.ts
 */
export const eventSessions = pgTable(
  "event_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** morning | afternoon */
    code: varchar("code", { length: 20 }).notNull(),
    nameTh: varchar("name_th", { length: 100 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /** จำนวนที่นั่งที่เปิดรับ */
    quota: integer("quota").notNull(),
    /** นับรวมทั้งที่ลงทะเบียนแล้วและที่กำลังจองค้าง — ตัวเลขที่ใช้ตัดโควตา */
    reservedCount: integer("reserved_count").notNull().default(0),
    /** อัปเดตตอนเช็คอิน (denormalize เพื่อความเร็วของตัวนับ real-time) */
    checkedInCount: integer("checked_in_count").notNull().default(0),

    isClosed: boolean("is_closed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_sessions_event_code_uq").on(t.eventId, t.code)],
);

/** ตารางที่ 3 — คำถามในฟอร์ม (Admin แก้ได้จากหลังบ้าน ไม่ต้องแก้โค้ด) */
export const formQuestions = pgTable(
  "form_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** occupation | hear_from | favorite_tnn_program | ... */
    key: varchar("key", { length: 60 }).notNull(),
    labelTh: text("label_th").notNull(),
    labelEn: text("label_en"),
    /** ข้อความตัวเอียงในวงเล็บใต้ฟิลด์ ตามภาพอ้างอิง */
    helperTextTh: text("helper_text_th"),
    helperTextEn: text("helper_text_en"),

    type: questionTypeEnum("type").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    /** เช่น รายการ TNN = เลือก 1–3 รายการ */
    minSelect: integer("min_select"),
    maxSelect: integer("max_select"),
    hasOtherOption: boolean("has_other_option").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("form_questions_event_key_uq").on(t.eventId, t.key)],
);

/** ตารางที่ 4 — ตัวเลือกของแต่ละคำถาม */
export const formOptions = pgTable(
  "form_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => formQuestions.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 80 }).notNull(),
    labelTh: text("label_th").notNull(),
    labelEn: text("label_en"),
    /** true = ตัวเลือก "อื่นๆ (โปรดระบุ)" ที่เปิดช่องให้พิมพ์เอง */
    isOther: boolean("is_other").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("form_options_question_idx").on(t.questionId, t.sortOrder),
    uniqueIndex("form_options_question_value_uq").on(t.questionId, t.value),
  ],
);

/** ตารางที่ 16 — ค่าตั้งค่าทั่วไป */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
