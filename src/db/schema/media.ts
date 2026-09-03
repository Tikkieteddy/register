import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { mediaTypeEnum } from "./enums";
import { events } from "./events";
import { users } from "./users";

/** ตารางที่ 17 — ไฟล์ภาพทั้งหมด (Media Manager ตามหัวข้อ 8.4) */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    type: mediaTypeEnum("type").notNull(),

    originalUrl: text("original_url").notNull(),
    webpUrl: text("webp_url"),
    avifUrl: text("avif_url"),
    /** รายการขนาดย่อยสำหรับ srcset เช่น [{"w":400,"url":"..."},{"w":800,"url":"..."}] */
    variants: jsonb("variants"),

    mimeType: varchar("mime_type", { length: 60 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    /** ใช้เตือนเมื่อไฟล์ใหญ่เกิน — โปสเตอร์ต้องไม่เกิน ~200 KB ตามข้อกำหนด E3 */
    sizeBytes: integer("size_bytes"),

    /** จำเป็นต่อคะแนน Accessibility ≥ 90 ตามเกณฑ์ E4 */
    altTextTh: text("alt_text_th"),
    altTextEn: text("alt_text_en"),
    captionTh: text("caption_th"),
    captionEn: text("caption_en"),

    sortOrder: integer("sort_order").notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_assets_event_type_idx").on(t.eventId, t.type, t.sortOrder)],
);
