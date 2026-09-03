import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { calendarProviderEnum, calendarSyncStatusEnum, emailStatusEnum } from "./enums";
import { registrations } from "./registrations";
import { users } from "./users";

/** ตารางที่ 13 — ประวัติการส่งอีเมล (หัวข้อ 8.2 — retry 3 ครั้งแล้วแจ้ง Admin) */
export const emailLogs = pgTable(
  "email_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "cascade",
    }),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    template: varchar("template", { length: 60 }).notNull(),
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 200 }),
    status: emailStatusEnum("status").notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_logs_registration_idx").on(t.registrationId),
    /** ให้ Admin กรองหาอีเมลที่ส่งไม่สำเร็จแล้วกด "ส่งซ้ำทั้งหมด" ได้เร็ว */
    index("email_logs_status_idx").on(t.status, t.createdAt),
  ],
);

/** ตารางที่ 15 — บันทึกการเข้าถึงและแก้ไขข้อมูล (ข้อกำหนด PDPA) */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** login | view_list | export | update | delete | resend_email | ... */
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }),
    entityId: varchar("entity_id", { length: 80 }),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    /** ⚠️ แฮชแล้วเท่านั้น ห้ามเก็บ IP ดิบ */
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_user_time_idx").on(t.userId, t.createdAt),
    index("audit_logs_action_time_idx").on(t.action, t.createdAt),
  ],
);

/**
 * ตารางที่ 20 — การเชื่อมปฏิทิน (หัวข้อ 8.1)
 *
 * ตามคำตอบ Q21 ระบบทำแค่ "ระดับ 1" คือปุ่มเพิ่มลงปฏิทินที่ไม่ต้องล็อกอิน
 * ตารางนี้จึงยังไม่ถูกใช้งาน แต่เตรียมโครงสร้างไว้เผื่ออัปเป็นระดับ 2 ภายหลัง
 * โดยไม่ต้อง migrate ใหม่
 *
 * 🔒 ถ้าเปิดใช้ระดับ 2: token ต้องเข้ารหัสก่อนเก็บเสมอ
 *    และขอสิทธิ์ขั้นต่ำ calendar.events เท่านั้น ไม่ขออ่านปฏิทินทั้งหมด
 */
export const calendarSyncs = pgTable(
  "calendar_syncs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    provider: calendarProviderEnum("provider").notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }),
    status: calendarSyncStatusEnum("status").notNull().default("pending"),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("calendar_syncs_registration_idx").on(t.registrationId)],
);
