import { and, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

/**
 * ลบข้อมูลส่วนบุคคลอัตโนมัติเมื่อครบระยะเวลาเก็บที่ผู้จัดงานตั้งไว้ (PDPA)
 *
 * กฎหมายกำหนดว่าห้ามเก็บข้อมูลส่วนบุคคลไว้นานเกินความจำเป็น
 * แต่ถ้าให้ผู้ดูแลมานั่งลบเองทุกงาน สุดท้ายจะไม่มีใครทำ ข้อมูลจะค้างอยู่ตลอดไป
 * ระบบจึงต้องลบให้เองตามรอบ
 *
 * ⚠️ "ลบ" ที่นี่คือลบเฉพาะสิ่งที่ระบุตัวบุคคลได้ (ชื่อ · อีเมล · เบอร์ · IP ที่แฮชไว้)
 *    ไม่ได้ลบทั้งแถว เพราะถ้าลบทิ้งทั้งหมด รายงานย้อนหลังจะเพี้ยน
 *    เช่นยอดผู้เข้าร่วมงานปีที่แล้วจะกลายเป็นศูนย์ ทั้งที่จัดไปจริง
 *    วิธีนี้ตรงกับที่เขียนไว้ในนโยบายความเป็นส่วนตัวข้อ 7
 *
 * ⚠️ ทำทีละงาน ไม่รวบยอดเป็นคำสั่งเดียว
 *    เพราะแต่ละงานมีระยะเวลาเก็บของตัวเอง และต้องนับจากวันจบงานของงานนั้น
 */
export type RetentionResult = {
  eventSlug: string;
  eventName: string;
  anonymized: number;
};

export async function anonymizeExpiredRegistrations(): Promise<RetentionResult[]> {
  // งานที่ตั้งระยะเวลาเก็บไว้ และจบไปนานเกินกำหนดแล้ว
  const expired = await db
    .select({
      id: events.id,
      slug: events.slug,
      nameTh: events.nameTh,
      retentionDays: events.dataRetentionDays,
    })
    .from(events)
    .where(
      and(
        isNotNull(events.dataRetentionDays),
        lt(events.endsAt, sql`now() - make_interval(days => ${events.dataRetentionDays})`),
      ),
    );

  const results: RetentionResult[] = [];

  for (const event of expired) {
    /**
     * เลือกเฉพาะรายการที่ยังไม่ถูกลบข้อมูล
     * ดูจากอีเมลที่ลงท้ายด้วย @invalid.local ซึ่งเป็นรูปแบบที่ระบบใส่แทนหลังลบ
     * (ใช้รูปแบบเดียวกับปุ่ม "ลบข้อมูลส่วนบุคคล" ในหน้าหลังบ้าน จะได้ไม่ทำซ้ำกัน)
     */
    const rows = await db.execute<{ id: string }>(sql`
      update registrations as r
      set first_name = 'ผู้ลงทะเบียน',
          last_name = '#' || r.registration_code,
          email = 'deleted+' || lower(r.registration_code) || '@invalid.local',
          phone = '0000000000',
          ip_hash = null,
          user_agent = null,
          updated_at = now()
      where r.event_id = ${event.id}
        and r.email not like '%@invalid.local'
      returning r.id
    `);

    if (rows.length > 0) {
      // บัตรเข้างานเก็บชื่อผู้ถือไว้ซ้ำเพื่อความเร็วตอนสแกน จึงต้องลบตามด้วย
      await db.execute(sql`
        update tickets as t
        set holder_first_name = 'ผู้ลงทะเบียน',
            holder_last_name = '#' || r.registration_code,
            holder_email = 'deleted+' || lower(r.registration_code) || '@invalid.local',
            updated_at = now()
        from registrations as r
        where t.registration_id = r.id
          and r.event_id = ${event.id}
      `);
    }

    results.push({
      eventSlug: event.slug,
      eventName: event.nameTh,
      anonymized: rows.length,
    });
  }

  return results;
}

/** ใช้แสดงในหน้าตั้งค่าว่าจะถึงกำหนดลบเมื่อไร */
export function retentionDueDate(eventEndsAt: Date, retentionDays: number): Date {
  return new Date(eventEndsAt.getTime() + retentionDays * 86_400_000);
}
