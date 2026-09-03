import {
  bigserial,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { badgeFormatEnum, checkInMethodEnum, ticketStatusEnum } from "./enums";
import { eventSessions } from "./events";
import { registrations } from "./registrations";
import { users } from "./users";

/**
 * ตารางที่ 8 — ตั๋วและ QR Code
 *
 * 1 การลงทะเบียนมีตั๋วได้หลายใบ (รองรับ "ตั๋วใบที่ 1, 2, …" ตามภาพอ้างอิง)
 * แต่ตามคำตอบ Q12 ระบบเปิดใช้จริงแค่ 1 ใบต่อ 1 อีเมล — ขยายทีหลังได้โดยไม่ต้องแก้โครงสร้าง
 */
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),

    /** โค้ดข้อความใต้ QR เช่น EOJEGQ2ZMZQ4Z — สำรองไว้กรณีสแกนไม่ติด */
    ticketCode: varchar("ticket_code", { length: 20 }).notNull(),
    /**
     * ⚠️ UUID v4 สุ่ม — ห้ามใส่ชื่อ อีเมล หรือเบอร์โทรลงใน QR โดยตรง
     * และต้องตรวจสอบความถูกต้องฝั่งเซิร์ฟเวอร์ทุกครั้ง ห้ามเชื่อข้อมูลจากฝั่ง client
     */
    qrToken: uuid("qr_token").defaultRandom().notNull(),

    ticketType: varchar("ticket_type", { length: 50 }).notNull().default("Free"),
    /** เจ้าของตั๋วอาจไม่ใช่ผู้สั่งจอง (กรณีลงทะเบียนหลายใบ) */
    holderFirstName: varchar("holder_first_name", { length: 100 }).notNull(),
    holderLastName: varchar("holder_last_name", { length: 100 }).notNull(),
    holderEmail: varchar("holder_email", { length: 255 }).notNull(),

    status: ticketStatusEnum("status").notNull().default("valid"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** จำเป็นมาก — การสแกนต้องตอบภายใน < 500 ms ตามเกณฑ์ E4 */
    uniqueIndex("tickets_qr_token_uq").on(t.qrToken),
    uniqueIndex("tickets_code_uq").on(t.ticketCode),
    index("tickets_registration_idx").on(t.registrationId),
  ],
);

/** ตารางที่ 9 — บันทึกการเช็คอิน */
export const checkIns = pgTable(
  "check_ins",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    /** ใครเป็นคนเช็คอินให้ — Staff หรือ Admin (ตามหัวข้อ 8.3 Admin ก็สแกนได้) */
    staffUserId: uuid("staff_user_id").references(() => users.id, { onDelete: "set null" }),

    /** เวลาจริงที่สแกน — ตอนออฟไลน์ใช้เวลาจากเครื่องเจ้าหน้าที่ */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    /** เวลาที่ข้อมูลขึ้นถึงเซิร์ฟเวอร์ — ต่างจาก checkedInAt เมื่อทำงานออฟไลน์ */
    syncedAt: timestamp("synced_at", { withTimezone: true }),

    method: checkInMethodEnum("method").notNull().default("qr"),
    /** รหัสเครื่องที่สแกน ไว้แกะรอยตอน sync ชนกัน */
    deviceId: varchar("device_id", { length: 80 }),
    isOfflineSync: boolean("is_offline_sync").notNull().default(false),
    note: text("note"),
  },
  (t) => [
    /**
     * ⭐ กลไกที่ทำให้ตรวจ "สแกนซ้ำ" ได้อัตโนมัติที่ระดับฐานข้อมูล
     * และทำให้กฎ "เวลาเช็คอินที่เร็วที่สุดชนะ" ตอน sync ออฟไลน์ทำงานได้ถูกต้อง
     */
    uniqueIndex("check_ins_ticket_session_uq").on(t.ticketId, t.sessionId),
    index("check_ins_session_time_idx").on(t.sessionId, t.checkedInAt),
    index("check_ins_staff_idx").on(t.staffUserId),
  ],
);

/** ตารางที่ 14 — ประวัติการพิมพ์บัตร (รู้ว่าใช้กระดาษไปเท่าไร ใครสั่งพิมพ์) */
export const badgePrints = pgTable(
  "badge_prints",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    staffUserId: uuid("staff_user_id").references(() => users.id, { onDelete: "set null" }),
    format: badgeFormatEnum("format").notNull().default("lanyard"),
    isReprint: boolean("is_reprint").notNull().default(false),
    printedAt: timestamp("printed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("badge_prints_ticket_idx").on(t.ticketId)],
);
