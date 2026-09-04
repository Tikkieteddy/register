import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

/**
 * งานที่เจ้าหน้าที่กำลังทำอยู่
 *
 * ระบบรองรับหลายงานในฐานข้อมูลเดียว แต่หน้างานจริงมีงานเดียวที่กำลังจัด
 * จึงเลือกงานที่เผยแพร่อยู่และใกล้ที่สุดโดยอัตโนมัติ เพื่อไม่ให้เจ้าหน้าที่
 * ต้องเลือกงานเองทุกครั้ง ซึ่งเสี่ยงเลือกผิดตอนคิวยาว
 *
 * ถ้าในอนาคตมีหลายงานพร้อมกัน ค่อยเพิ่มหน้าให้เลือกงานในเฟส 5
 */
export async function getActiveEventSlug(): Promise<string | null> {
  const [event] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(or(eq(events.status, "published"), eq(events.status, "closed")))
    .orderBy(desc(events.startsAt))
    .limit(1);
  return event?.slug ?? null;
}
