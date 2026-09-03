import { pgEnum } from "drizzle-orm/pg-core";

/** สถานะของงาน — draft ยังไม่เผยแพร่ / published เปิดให้เห็น / closed ปิดรับ / archived เก็บเข้าคลัง */
export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "closed", "archived"]);

/** ชนิดคำถามในฟอร์ม ตามข้อกำหนด D3 */
export const questionTypeEnum = pgEnum("question_type", [
  "text",
  "dropdown",
  "radio",
  "checkbox",
  "consent",
]);

/** สถานะการลงทะเบียน */
export const registrationStatusEnum = pgEnum("registration_status", [
  "confirmed",
  "cancelled",
  "waitlist",
  "no_show",
]);

/** ที่มาของการลงทะเบียน — online ผ่านเว็บ / walkin หน้างาน / admin_manual Admin เพิ่มให้ */
export const registrationSourceEnum = pgEnum("registration_source", [
  "online",
  "walkin",
  "admin_manual",
]);

/** สถานะตั๋ว */
export const ticketStatusEnum = pgEnum("ticket_status", ["valid", "used", "void"]);

/** วิธีที่เจ้าหน้าที่ใช้เช็คอิน — แยกสถิติได้ว่า QR ใช้งานได้ดีแค่ไหน */
export const checkInMethodEnum = pgEnum("check_in_method", ["qr", "search", "walkin"]);

/** บทบาทผู้ใช้ระบบ */
export const userRoleEnum = pgEnum("user_role", ["admin", "staff", "viewer"]);

/** ประเภทความยินยอม (PDPA) */
export const consentTypeEnum = pgEnum("consent_type", ["pdpa", "photo", "terms", "marketing"]);

/** สถานะการส่งอีเมล */
export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sent",
  "failed",
  "bounced",
  "complained",
]);

/** รูปแบบบัตรที่พิมพ์ */
export const badgeFormatEnum = pgEnum("badge_format", ["lanyard", "wristband", "sticker"]);

/** ประเภทไฟล์ภาพ ตามหัวข้อ 8.4 */
export const mediaTypeEnum = pgEnum("media_type", [
  "logo",
  "poster",
  "banner",
  "speaker",
  "sponsor",
  "badge_background",
  "gallery",
  "og_image",
]);

/** เหตุการณ์ที่เกิดกับลิงก์ติดตามผล ตามหัวข้อ 8.5 */
export const linkActionEnum = pgEnum("link_action", ["click", "view_form", "share", "copy_link"]);

/** ผู้ให้บริการปฏิทิน ตามหัวข้อ 8.1 */
export const calendarProviderEnum = pgEnum("calendar_provider", ["google", "outlook", "apple"]);

/** สถานะการเชื่อมปฏิทิน */
export const calendarSyncStatusEnum = pgEnum("calendar_sync_status", [
  "pending",
  "synced",
  "failed",
  "deleted",
]);
