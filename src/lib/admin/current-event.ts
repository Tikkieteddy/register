import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

/**
 * งานที่หลังบ้านกำลังจัดการอยู่
 *
 * ต่างจาก getActiveEventSlug ของฝั่งเจ้าหน้าที่ตรงที่หลังบ้านต้องเห็น
 * งานที่ยังเป็น draft ด้วย ไม่งั้นตั้งค่างานใหม่ก่อนเปิดรับไม่ได้เลย
 *
 * เลือกงานได้เองผ่าน ?event=<slug> เผื่อกรณีมีหลายงานพร้อมกัน
 */
export async function getAdminEvent(slug?: string) {
  if (slug) {
    const [byslug] = await db.select().from(events).where(eq(events.slug, slug));
    if (byslug) return byslug;
  }
  const [latest] = await db.select().from(events).orderBy(desc(events.startsAt)).limit(1);
  return latest ?? null;
}

export async function listAdminEvents() {
  return db
    .select({ id: events.id, slug: events.slug, nameTh: events.nameTh, status: events.status })
    .from(events)
    .orderBy(desc(events.startsAt));
}
