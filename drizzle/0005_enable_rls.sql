-- ปิดประตูหลังของ Supabase ด้วย Row Level Security
--
-- ที่มา: Supabase ส่งอีเมลเตือนว่า "Table publicly accessible" และ
--        "Sensitive data publicly accessible"
--
-- Supabase เปิดช่องทางเรียกข้อมูลผ่านเว็บ (PostgREST) ให้ทุกโปรเจกต์อัตโนมัติ
-- ตั้งแต่วันแรก ช่องทางนั้นใช้บัญชี anon กับ authenticated ซึ่งถูกคุมด้วย RLS
--
-- ระบบนี้ไม่เคยใช้ช่องทางดังกล่าวเลย — ต่อ PostgreSQL ตรง ๆ ผ่าน Drizzle
-- ด้วยบัญชีเจ้าของตาราง จึงไม่เคยตั้ง RLS ไว้ ประตูเลยเปิดค้างอยู่
--
-- ⚠️ ตั้งใจไม่สร้าง policy ใด ๆ ทั้งสิ้น
--    เปิด RLS โดยไม่มี policy = บัญชี anon และ authenticated อ่านได้ศูนย์แถว
--    ซึ่งคือสิ่งที่ต้องการ เพราะไม่มีใครควรเข้าทางนั้นได้
--
-- ⚠️ ระบบเราไม่กระทบ เพราะเจ้าของตารางไม่ติด RLS ตามค่าเริ่มต้นของ PostgreSQL
--    (ไม่ได้สั่ง FORCE ROW LEVEL SECURITY ไว้)
--
-- ⚠️ ผลข้างเคียงที่ต้องรู้: หน้า Table Editor ในเว็บ Supabase จะแสดงตารางว่าง
--    เพราะหน้านั้นเข้าทางประตูหลังเหมือนกัน ข้อมูลยังอยู่ครบ ดูได้ที่หลังบ้านของเรา

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "badge_prints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "calendar_syncs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "check_ins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "event_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "form_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "form_questions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "link_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registration_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registration_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "registrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "seat_holds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
