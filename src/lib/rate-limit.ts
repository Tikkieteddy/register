import { sql } from "drizzle-orm";
import { db } from "@/db";
import { hashIdentifier } from "@/lib/hash";

/**
 * จำกัดจำนวนครั้งที่เรียกใช้งานต่อช่วงเวลา (rate limiting)
 *
 * ใช้วิธี fixed window ที่ฐานข้อมูล — นับเป็นช่วง ๆ ช่วงละ N วินาที
 * เลือกวิธีนี้เพราะทำได้ในคำสั่ง SQL เดียวแบบ atomic จึงไม่มีช่องว่างให้
 * คำขอที่เข้ามาพร้อมกันหลุดรอดไปได้ ต่างจากการอ่านค่ามานับแล้วค่อยเขียนกลับ
 *
 * ⚠️ ห้ามเก็บตัวนับไว้ในหน่วยความจำของเซิร์ฟเวอร์
 *    บน Vercel คำขอแต่ละครั้งอาจไปตกที่เครื่องคนละตัว ตัวนับในหน่วยความจำจึงกันอะไรไม่ได้
 *
 * ⚠️ ถ้าฐานข้อมูลมีปัญหา ระบบจะ "ปล่อยผ่าน" ไม่ใช่ "ปิดกั้น"
 *    เพราะการที่คนทั้งงานลงทะเบียนไม่ได้เลยเพราะตัวนับล่ม เสียหายมากกว่าการที่
 *    มีคนยิงถล่มหลุดเข้ามาได้ชั่วครู่ (ยังมีการตรวจสอบชั้นอื่นรออยู่)
 */
export type RateLimitResult = {
  allowed: boolean;
  /** จำนวนวินาทีที่ต้องรอก่อนลองใหม่ — ใช้บอกผู้ใช้ให้ชัดว่ารออีกนานเท่าไร */
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const rows = await db.execute<{ count: number; elapsed: number }>(sql`
      insert into rate_limits as rl (key, count, window_started_at)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case
          when rl.window_started_at <= now() - make_interval(secs => ${windowSeconds})
          then 1
          else rl.count + 1
        end,
        window_started_at = case
          when rl.window_started_at <= now() - make_interval(secs => ${windowSeconds})
          then now()
          else rl.window_started_at
        end
      returning count, extract(epoch from (now() - window_started_at))::int as elapsed
    `);

    const row = rows[0];
    if (!row) return { allowed: true, retryAfterSeconds: 0 };

    const allowed = Number(row.count) <= limit;
    const retryAfterSeconds = allowed ? 0 : Math.max(windowSeconds - Number(row.elapsed), 1);
    return { allowed, retryAfterSeconds };
  } catch {
    // ปล่อยผ่านเมื่อตัวนับใช้งานไม่ได้ ตามเหตุผลที่อธิบายไว้ด้านบน
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * สร้าง key ที่ปลอดภัยตาม PDPA
 * แฮช IP ก่อนเสมอ ตารางตัวนับจึงไม่กลายเป็นที่เก็บ IP ดิบ
 */
export function rateLimitKey(action: string, identifier: string): string {
  return `${action}:${hashIdentifier(identifier)}`.slice(0, 160);
}

/**
 * เพดานที่ใช้จริงในระบบ — รวมไว้ที่เดียวเพื่อให้ตรวจทานง่ายตอนทำรายงานความปลอดภัย
 *
 * ⚠️ ตัวเลขเหล่านี้ตั้งไว้สูงกว่าที่คิดตอนแรกมาก เพราะ "หนึ่ง IP ไม่ได้เท่ากับหนึ่งคน"
 *
 *    ในงานจริงคนทั้งงานต่อ Wi-Fi ตัวเดียวกัน ระบบเครือข่ายจะรวมทุกเครื่อง
 *    ให้ออกไปด้วยที่อยู่ IP เดียว (NAT) ฝั่งเซิร์ฟเวอร์จึงเห็นเป็นคนคนเดียวยิงรัว ๆ
 *
 *    ถ้าตั้งเพดานต่ำ:
 *      • ผู้มาลงทะเบียนหน้างานคนที่ 9 เป็นต้นไปจะลงทะเบียนไม่ได้ทั้งงาน
 *      • เจ้าหน้าที่ที่ทยอยล็อกอินตอนเช้าจะถูกบล็อกตั้งแต่คนที่ 13
 *    ซึ่งเสียหายกว่าการโดนยิงถล่มมาก และเป็นความเสียหายที่เกิดขึ้นแน่นอน ไม่ใช่แค่ความเสี่ยง
 *
 *    ด่านนี้จึงมีหน้าที่กัน "สคริปต์ที่ยิงเป็นพันครั้ง" เท่านั้น
 *    ส่วนการเดารหัสผ่านรายบัญชี มีระบบล็อกบัญชี 5 ครั้ง/15 นาที คุมอยู่แล้วซึ่งแม่นยำกว่า
 */
export const RATE_LIMITS = {
  /** ลงทะเบียน — เผื่อคนหน้างานหลายสิบคนต่อ Wi-Fi เดียวกันพร้อมกัน */
  register: { limit: 40, windowSeconds: 600 },
  /** ล็อกอิน — เผื่อเจ้าหน้าที่ทั้งทีมล็อกอินจากเครือข่ายเดียวกันตอนเปิดงาน */
  login: { limit: 40, windowSeconds: 600 },
  /** รายชื่อสำรอง — ใช้น้อยกว่าและไม่ใช่ทางที่คนหน้างานต้องใช้พร้อมกัน */
  waitlist: { limit: 20, windowSeconds: 600 },

  /**
   * จองที่นั่งชั่วคราว — ด่านนี้สำคัญกว่าด่านลงทะเบียน
   *
   * การจองที่นั่งไม่ต้องกรอกอะไรเลย ยิงคำสั่งเดียวก็กันที่นั่งไว้ได้ 15 นาที
   * ถ้าไม่มีด่านนี้ สคริปต์ยิงรัว ๆ ไม่กี่วินาทีก็ทำให้ทั้งงานขึ้นว่า "เต็มแล้ว" ได้
   * ทั้งที่ไม่มีใครลงทะเบียนจริงสักคน
   *
   * ใช้หน้าต่างสั้น 1 นาที ไม่ใช่ 10 นาที เพราะสิ่งที่แยกคนจริงออกจากสคริปต์
   * คือ "ความถี่" ไม่ใช่ "ยอดรวม" — คนจริงติ๊กเลือกช่วงเวลาได้เต็มที่ไม่กี่ครั้งต่อนาที
   * ส่วนสคริปต์ยิงเป็นร้อยครั้งในไม่กี่วินาที
   *
   * เพดาน 60 ครั้ง/นาที เผื่อคนหน้างานหลายสิบคนต่อ Wi-Fi เดียวกัน (NAT)
   * ติ๊กเลือกช่วงเวลาในนาทีเดียวกันไว้แล้ว
   *
   * ⚠️ ด่านนี้กันคนยิงจากที่อยู่เดียวเท่านั้น กันคนที่ยิงจากหลายที่อยู่พร้อมกันไม่ได้
   *    ถ้าเจอกรณีนั้นจริง ต้องเปิด reCAPTCHA เพิ่ม (อยู่ในงานเฟสถัดไป)
   */
  hold: { limit: 60, windowSeconds: 60 },

  /**
   * บันทึกสถิติการเปิดหน้าฟอร์มและการกดแชร์
   *
   * ไม่ใช่เรื่องความปลอดภัยของที่นั่ง แต่เป็นเรื่อง "ตัวเลขต้องเชื่อถือได้"
   * และ "ตารางต้องไม่บวมจนเต็มโควตาฐานข้อมูล" — ใครก็ยิงเข้ามาได้โดยไม่ต้องล็อกอิน
   * ถ้าไม่มีด่านนี้ กราฟกรวยการแปลงในหน้ารายงานจะถูกปั่นให้เพี้ยนได้ง่าย ๆ
   */
  track: { limit: 200, windowSeconds: 600 },
} as const;

/** ลบตัวนับที่หมดอายุแล้วทิ้ง ไม่ให้ตารางโตขึ้นเรื่อย ๆ โดยไม่มีที่สิ้นสุด */
export async function cleanupRateLimits(): Promise<number> {
  const rows = await db.execute<{ key: string }>(sql`
    delete from rate_limits where window_started_at < now() - interval '1 day' returning key
  `);
  return rows.length;
}
