import {
  bigserial,
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { consentTypeEnum, registrationSourceEnum, registrationStatusEnum } from "./enums";
import { eventSessions, events, formOptions, formQuestions } from "./events";
import { shareLinks } from "./tracking";

/** ตารางที่ 5 — ผู้ลงทะเบียน (ตารางหลักของระบบ) */
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    /** โค้ดสั้นอ่านง่าย เช่น EOJEGQ — ไม่ใช้ตัว 0 O 1 I L กันสับสนตอนอ่านออกเสียง */
    registrationCode: varchar("registration_code", { length: 10 }).notNull(),

    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    /** เก็บเป็นตัวพิมพ์เล็กเสมอ เพื่อให้ unique index ทำงานถูกต้อง */
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    phoneCountryCode: varchar("phone_country_code", { length: 5 }).notNull().default("+66"),

    occupation: varchar("occupation", { length: 120 }),
    occupationOther: varchar("occupation_other", { length: 200 }),

    status: registrationStatusEnum("status").notNull().default("confirmed"),
    source: registrationSourceEnum("source").notNull().default("online"),

    /** ผูกว่าคนนี้มาจากลิงก์ติดตามผลไหน → ใช้คำนวณ conversion rate รายลิงก์ (หัวข้อ 8.5) */
    shareLinkId: uuid("share_link_id").references(() => shareLinks.id, { onDelete: "set null" }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),

    locale: varchar("locale", { length: 5 }).notNull().default("th"),
    /** แฮชแล้วเท่านั้น ห้ามเก็บ IP ดิบ (PDPA) */
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    saveForNextTime: boolean("save_for_next_time").notNull().default(false),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** กันลงทะเบียนซ้ำด้วยอีเมลเดิมในงานเดียวกัน */
    uniqueIndex("registrations_event_email_uq").on(t.eventId, t.email),
    uniqueIndex("registrations_code_uq").on(t.registrationCode),
    index("registrations_event_status_idx").on(t.eventId, t.status),
    index("registrations_phone_idx").on(t.phone),
    index("registrations_created_idx").on(t.createdAt),
    index("registrations_share_link_idx").on(t.shareLinkId),
  ],
);

/** ตารางที่ 6 — ผู้ลงทะเบียนเลือกช่วงเวลาไหนบ้าง (ตารางเชื่อม M:N) */
export const registrationSessions = pgTable(
  "registration_sessions",
  {
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** PK ร่วม 2 ฟิลด์ กันเลือกช่วงเดิมซ้ำ */
    primaryKey({ columns: [t.registrationId, t.sessionId] }),
    index("registration_sessions_session_idx").on(t.sessionId),
  ],
);

/** ตารางที่ 7 — คำตอบของคำถามเพิ่มเติม */
export const registrationAnswers = pgTable(
  "registration_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => formQuestions.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => formOptions.id, { onDelete: "set null" }),
    /** ใช้กับตัวเลือก "อื่นๆ ระบุ" และคำถามชนิด text */
    valueText: text("value_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** ทำให้กราฟที่ 4 5 6 คำนวณได้เร็ว */
    index("registration_answers_question_option_idx").on(t.questionId, t.optionId),
    index("registration_answers_registration_idx").on(t.registrationId),
  ],
);

/** ตารางที่ 10 — การจองที่นั่งชั่วคราว 15 นาที */
export const seatHolds = pgTable(
  "seat_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    /** token ที่ฝั่ง client ถือไว้ระหว่างกรอกฟอร์ม */
    holdToken: uuid("hold_token").defaultRandom().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** ถ้ากรอกฟอร์มสำเร็จ จะผูกกับ registration แล้วไม่ถูกกวาดทิ้ง */
    convertedRegistrationId: uuid("converted_registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seat_holds_token_uq").on(t.holdToken),
    /** job ทุก 5 นาทีกวาดแถวที่หมดอายุแล้วคืนที่นั่ง */
    index("seat_holds_expires_idx").on(t.expiresAt),
    index("seat_holds_session_idx").on(t.sessionId),
  ],
);

/**
 * ตารางที่ 12 — หลักฐานความยินยอม (PDPA)
 *
 * แยกเป็นตารางต่างหากเพื่อพิสูจน์ได้ว่า "ยินยอมข้อไหน เมื่อไร นโยบายเวอร์ชันไหน"
 * ซึ่งเป็นสิ่งที่กฎหมาย PDPA ต้องการ
 */
export const consents = pgTable(
  "consents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    type: consentTypeEnum("type").notNull(),
    isGranted: boolean("is_granted").notNull(),
    policyVersion: varchar("policy_version", { length: 20 }).notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => [index("consents_registration_type_idx").on(t.registrationId, t.type)],
);
