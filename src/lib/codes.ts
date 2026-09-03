import { customAlphabet } from "nanoid";

/**
 * ตัวอักษรที่ใช้สร้างรหัส — ตัด 0 O 1 I L ออก
 * เพราะหน้างานเจ้าหน้าที่ต้องอ่านรหัสให้ผู้ร่วมงานฟัง หรือผู้ร่วมงานพิมพ์เอง
 * ตัวที่หน้าตาคล้ายกันจะทำให้สับสนและกรอกผิด
 */
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const registrationCodeGenerator = customAlphabet(SAFE_ALPHABET, 6);
const ticketSuffixGenerator = customAlphabet(SAFE_ALPHABET, 7);

/** รหัสผู้ลงทะเบียนแบบอ่านง่าย เช่น EOJEGQ (6 ตัว) */
export function generateRegistrationCode(): string {
  return registrationCodeGenerator();
}

/**
 * โค้ดข้อความใต้ QR เช่น EOJEGQ2ZMZQ4Z
 * ขึ้นต้นด้วยรหัสผู้ลงทะเบียนเพื่อให้ไล่หาต้นทางได้ด้วยตาเปล่า
 */
export function generateTicketCode(registrationCode: string): string {
  return `${registrationCode}${ticketSuffixGenerator()}`;
}
