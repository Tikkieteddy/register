import bcrypt from "bcryptjs";

/**
 * แฮชรหัสผ่านด้วย bcrypt
 *
 * cost 12 เป็นค่าที่สมดุลระหว่างความปลอดภัยกับความเร็ว
 * ใช้เวลาแฮชประมาณ 200-300 ms ซึ่งช้าพอที่จะกันการเดารหัสจำนวนมาก
 * แต่ยังเร็วพอสำหรับการล็อกอินหน้างาน
 */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // รหัสผ่านที่ยังไม่ได้ตั้ง (แฮชว่าง) ต้องไม่ผ่านเสมอ
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
