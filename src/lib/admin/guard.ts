import { redirect } from "next/navigation";
import { canManageUsers, canOpenCms, getSession, type SessionUser } from "@/lib/auth/session";

/**
 * ด่านตรวจสิทธิ์ของทุกหน้าในหลังบ้าน
 *
 * ⚠️ ต้องเรียกในทุกหน้าและทุก server action ของ /admin-cms
 *    ห้ามเชื่อว่า "เข้ามาถึงหน้านี้ได้แปลว่ามีสิทธิ์" เพราะ server action
 *    ถูกยิงตรงจากภายนอกได้โดยไม่ผ่านหน้าเว็บ
 *
 * ผ่านได้ทั้งผู้ดูแลระบบและผู้จัดงาน — ส่วนที่ผู้จัดงานทำไม่ได้มีเฉพาะ
 * การเพิ่มหรือแก้บัญชีผู้ใช้ ซึ่งใช้ requireUserAdmin() คุมแยกต่างหาก
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession();
  /**
   * ไม่ส่ง ?next= ไปด้วย เพราะหน้าทางเข้าให้เลือกส่วนงานเองเสมอหลังล็อกอิน
   * ใส่ไปก็ไม่มีผล แล้วจะทำให้คนอ่านโค้ดเข้าใจผิดว่าระบบพากลับที่เดิมให้
   */
  if (!user) redirect("/admin");
  // มีสิทธิ์เข้าระบบ แต่เป็นเจ้าหน้าที่หน้างาน — ส่งกลับหน้าเลือกทางเข้า ซึ่งจะบอกเองว่าเข้าอะไรได้บ้าง
  if (!canOpenCms(user)) redirect("/admin?denied=cms");
  return user;
}

/**
 * ด่านตรวจของส่วนจัดการบัญชีผู้ใช้ — เฉพาะผู้ดูแลระบบ
 *
 * ⚠️ ต้องคุมที่ server action ด้วย ไม่ใช่แค่ซ่อนปุ่มบนหน้าจอ
 *    ผู้จัดงานเปิดหลังบ้านได้อยู่แล้ว จึงยิง action ตรงได้ถ้ารู้ชื่อ
 *    การซ่อนปุ่มอย่างเดียวจึงกันได้แค่คนที่ไม่ตั้งใจ ไม่ได้กันคนที่ตั้งใจ
 */
export async function requireUserAdmin(): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!canManageUsers(user)) redirect("/admin-cms/users?denied=1");
  return user;
}

/**
 * รุ่นที่ใช้ใน server action — คืน null แทนการ redirect
 * เพื่อให้ action ตอบกลับเป็นข้อความภาษาไทยได้แทนที่จะเด้งหน้าเปล่า
 */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getSession();
  return user && canOpenCms(user) ? user : null;
}

/** รุ่นสำหรับ action ที่แตะบัญชีผู้ใช้ — ผู้จัดงานต้องไม่ผ่านด่านนี้ */
export async function getUserAdminOrNull(): Promise<SessionUser | null> {
  const user = await getSession();
  return user && canManageUsers(user) ? user : null;
}

export const NOT_ADMIN_MESSAGE = "ไม่มีสิทธิ์ใช้งานส่วนนี้ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล";

export const NOT_USER_ADMIN_MESSAGE =
  "เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มหรือแก้บัญชีผู้ใช้ได้";
