-- ยกเลิกแล้วต้องกลับมาลงทะเบียนใหม่ได้
--
-- เดิม index นี้บังคับว่า 1 อีเมล = 1 แถวต่อ 1 งาน โดยไม่สนใจสถานะ
-- ผลคือคนที่แจ้งยกเลิกไว้แล้วเปลี่ยนใจ จะลงทะเบียนใหม่ไม่ได้อีกเลยตลอดกาล
-- และแก้จากหน้าจอไม่ได้ ต้องเข้าไปลบแถวในฐานข้อมูลโดยตรงเท่านั้น
--
-- เปลี่ยนเป็น index ที่ไม่นับแถวซึ่ง status = 'cancelled'
-- โค้ดฝั่งแอปที่ตรวจอีเมลซ้ำใช้เงื่อนไขเดียวกันนี้ ถ้าจะแก้ต้องแก้คู่กันเสมอ

DROP INDEX "registrations_event_email_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_email_uq" ON "registrations" USING btree ("event_id","email") WHERE "registrations"."status" <> 'cancelled';