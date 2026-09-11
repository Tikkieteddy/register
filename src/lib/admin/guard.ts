import { redirect } from "next/navigation";
import { getSession, isAdmin, type SessionUser } from "@/lib/auth/session";

/**
 * ด่านตรวจสิทธิ์ของทุกหน้าในหลังบ้าน
 *
 * ⚠️ ต้องเรียกในทุกหน้าและทุก server action ของ /admin
 *    ห้ามเชื่อว่า "เข้ามาถึงหน้านี้ได้แปลว่ามีสิทธิ์" เพราะ server action
 *    ถูกยิงตรงจากภายนอกได้โดยไม่ผ่านหน้าเว็บ
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession();
  /**
   * ไม่ส่ง ?next= ไปด้วย เพราะหน้าทางเข้าให้เลือกส่วนงานเองเสมอหลังล็อกอิน
   * ใส่ไปก็ไม่มีผล แล้วจะทำให้คนอ่านโค้ดเข้าใจผิดว่าระบบพากลับที่เดิมให้
   */
  if (!user) redirect("/admin");
  // มีสิทธิ์เข้าระบบ แต่ไม่ใช่ผู้ดูแล — ส่งกลับหน้าเลือกทางเข้า ซึ่งจะบอกเองว่าเข้าอะไรได้บ้าง
  if (!isAdmin(user)) redirect("/admin?denied=cms");
  return user;
}

/**
 * รุ่นที่ใช้ใน server action — คืน null แทนการ redirect
 * เพื่อให้ action ตอบกลับเป็นข้อความภาษาไทยได้แทนที่จะเด้งหน้าเปล่า
 */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getSession();
  return user && isAdmin(user) ? user : null;
}

export const NOT_ADMIN_MESSAGE = "ไม่มีสิทธิ์ใช้งานส่วนนี้ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล";
