import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums";

/** ตารางที่ 11 — บัญชีเจ้าหน้าที่และผู้ดูแลระบบ */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** เก็บเป็นตัวพิมพ์เล็กเสมอ (normalize ในชั้น application) */
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    role: userRoleEnum("role").notNull().default("staff"),

    /**
     * สิทธิ์เข้าหน้าสแกน QR — ตามข้อกำหนดรอบที่ 2 หัวข้อ 8.3
     * Admin ทุกคนสแกนได้เลย แต่มีฟิลด์นี้ไว้ปิดเป็นรายคนได้ภายหลัง (Q23)
     */
    canScan: boolean("can_scan").notNull().default(true),

    isActive: boolean("is_active").notNull().default(true),
    /** ความลับสำหรับ 2FA (แนะนำให้ Admin เปิดใช้) */
    totpSecret: varchar("totp_secret", { length: 255 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** ล็อกบัญชี 15 นาทีเมื่อล็อกอินผิด 5 ครั้ง */
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_idx").on(t.role, t.isActive),
  ],
);
