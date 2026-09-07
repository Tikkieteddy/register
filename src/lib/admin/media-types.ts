/**
 * ประเภทภาพที่ระบบรองรับ (หัวข้อ 8.4)
 *
 * แยกไฟล์ออกมาเพื่อให้ทั้งฝั่งเซิร์ฟเวอร์และฝั่งหน้าเว็บใช้รายการเดียวกัน
 * โดยที่หน้าเว็บไม่ต้องดึง sharp ซึ่งเป็นไลบรารีฝั่งเซิร์ฟเวอร์ล้วน ๆ ติดไปด้วย
 */
export const MEDIA_TYPES = [
  "logo",
  "poster",
  "banner",
  "speaker",
  "sponsor",
  "badge_background",
  "gallery",
  "og_image",
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_INFO: Record<MediaType, { label: string; usedAt: string; size: string }> = {
  logo: {
    label: "โลโก้",
    usedAt: "หัวทุกหน้า · อีเมล · บัตรห้อยคอ · ตั๋วพิมพ์",
    size: "SVG หรือ PNG โปร่งใส สูง ≥ 200px",
  },
  poster: {
    label: "โปสเตอร์งาน",
    usedAt: "ภาพหลักหน้ารายละเอียดงาน · การ์ดสรุปงาน · การ์ดตั๋ว",
    size: "1200×1200 px",
  },
  banner: { label: "แบนเนอร์", usedAt: "แถบกว้างบนหน้า Landing", size: "1920×640 px" },
  speaker: { label: "ภาพวิทยากร", usedAt: "การ์ดวิทยากรเด่น", size: "400×400 px จัตุรัส" },
  sponsor: {
    label: "โลโก้ผู้สนับสนุน",
    usedAt: "แถบท้ายบัตรห้อยคอ + ท้ายหน้าเว็บ",
    size: "PNG โปร่งใส",
  },
  badge_background: {
    label: "พื้นหลังบัตรห้อยคอ",
    usedAt: "บัตรห้อยคอที่พิมพ์หน้างาน",
    size: "ตามขนาดบัตรจริงที่ 300 DPI",
  },
  gallery: { label: "ภาพประกอบ", usedAt: "ส่วนรายละเอียดงานและไฮไลต์", size: "800×600 px" },
  og_image: {
    label: "ภาพตอนแชร์ลิงก์",
    usedAt: "ภาพที่ขึ้นเมื่อแชร์ลง  Facebook และ LINE",
    size: "1200×630 px",
  },
};
