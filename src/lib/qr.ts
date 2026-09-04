import QRCode from "qrcode";

/**
 * สร้าง QR Code สำหรับเช็คอินหน้างาน
 *
 * ⚠️ ข้อกำหนดด้านความปลอดภัย: QR เก็บเฉพาะ token สุ่ม (UUID v4) เท่านั้น
 *    ห้ามใส่ชื่อ อีเมล หรือเบอร์โทรลงใน QR โดยตรง
 *    และต้องตรวจสอบ token ฝั่งเซิร์ฟเวอร์ทุกครั้ง ห้ามเชื่อข้อมูลจากฝั่ง client
 */

const OPTIONS = {
  // ระดับ M ทนต่อความเสียหายของภาพได้ ~15% เหมาะกับการพิมพ์ลงกระดาษ
  errorCorrectionLevel: "M" as const,
  margin: 2,
  color: { dark: "#1C1714", light: "#FFFFFF" },
};

/** ภาพ QR แบบ data URI สำหรับฝังในหน้าเว็บและอีเมล */
export function qrDataUrl(token: string, size = 320): Promise<string> {
  return QRCode.toDataURL(token, { ...OPTIONS, width: size });
}

/** ภาพ QR แบบไฟล์ PNG สำหรับแนบไปกับอีเมล */
export async function qrPngBuffer(token: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(token, { ...OPTIONS, width: size, type: "png" });
}

/** ภาพ QR แบบ SVG — คมชัดทุกขนาด เหมาะกับหน้าพิมพ์ตั๋ว */
export function qrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { ...OPTIONS, type: "svg" });
}
