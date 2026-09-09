/**
 * สร้างชื่อสำหรับใช้ใน URL (slug) จากชื่องาน
 *
 * ⚠️ ตั้งใจไม่รองรับตัวอักษรไทยใน URL
 *    ถ้าปล่อยให้ slug เป็นภาษาไทย ลิงก์จะกลายเป็น %E0%B8%87%E0%B8%B2%E0%B8%99
 *    เวลาก็อปไปวางในไลน์หรืออีเมล ซึ่งอ่านไม่ออกและดูไม่น่าเชื่อถือ
 *    จึงคัดเฉพาะตัวอักษรอังกฤษกับตัวเลข แล้วให้ผู้ใช้แก้เองได้ทีหลัง
 */

/** คำที่ระบบจองไว้ใช้เอง ถ้าเอามาตั้งเป็นชื่องานจะทำให้เปิดหน้านั้นไม่ได้ */
export const RESERVED_SLUGS = new Set([
  "admin",
  "staff",
  "ticket",
  "api",
  "r",
  "e",
  "privacy",
  "terms",
  "_next",
  "favicon.ico",
]);

export function toSlug(input: string): string {
  return input
    .normalize("NFD")
    // ตัดเครื่องหมายเสียงสูงต่ำของภาษาละติน (é → e) ก่อนคัดตัวอักษร
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * เดา slug จากข้อมูลที่ผู้ใช้กรอก
 *
 * ใช้ชื่อภาษาอังกฤษก่อนเพราะแปลงเป็น URL ได้ตรงตัว
 * ถ้ามีแต่ชื่อไทยจะเหลือแต่ตัวเลข (เช่น "งานเปิดบ้าน 2026" → "2026")
 * จึงเติมคำว่า event นำหน้าให้ ไม่งั้นจะได้ slug ที่เป็นตัวเลขล้วนซึ่งอ่านไม่รู้เรื่อง
 */
export function suggestSlug(nameEn: string, nameTh: string, startsAt?: Date): string {
  const fromEn = toSlug(nameEn);
  if (fromEn && !/^\d+$/.test(fromEn)) return fromEn;

  const fromTh = toSlug(nameTh);
  const year = startsAt ? startsAt.getFullYear() : new Date().getFullYear();

  if (fromTh) return `event-${fromTh}`;
  return `event-${year}`;
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "โปรดระบุชื่อลิงก์";
  if (slug.length < 3) return "ชื่อลิงก์ต้องยาวอย่างน้อย 3 ตัวอักษร";
  if (slug.length > 80) return "ชื่อลิงก์ยาวเกิน 80 ตัวอักษร";
  if (!/^[a-z0-9-]+$/.test(slug)) return "ใช้ได้เฉพาะ a-z ตัวเลข และขีดกลาง (-)";
  if (slug.startsWith("-") || slug.endsWith("-")) return "ห้ามขึ้นต้นหรือลงท้ายด้วยขีดกลาง";
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" เป็นคำที่ระบบใช้อยู่แล้ว โปรดใช้คำอื่น`;
  return null;
}
