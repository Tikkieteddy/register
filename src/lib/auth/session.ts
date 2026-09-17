import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getServerEnv } from "@/lib/env";

/**
 * Session ของเจ้าหน้าที่และผู้ดูแลระบบ
 *
 * เก็บเป็น JWT ใน cookie แบบ httpOnly เพื่อให้ JavaScript ฝั่งหน้าเว็บอ่านไม่ได้
 * ป้องกันการขโมย session ผ่าน XSS
 */

const COOKIE_NAME = "staff_session";

/** อายุ session — 8 ชั่วโมงตามปกติ หรือ 24 ชั่วโมงถ้าติ๊ก "จดจำอุปกรณ์นี้" */
const DEFAULT_HOURS = 8;
const REMEMBERED_HOURS = 24;

/** ค่าสิทธิ์ทั้งหมดที่มีจริงในระบบ — ใช้ตรวจค่าที่อ่านมาจากโทเคน */
const ROLES = ["admin", "organizer", "staff", "viewer"] as const;

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "organizer" | "staff" | "viewer";
  canScan: boolean;
};

function getSecret(): Uint8Array {
  const env = getServerEnv();
  const secret = env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า SESSION_SECRET — จำเป็นต่อการเข้าสู่ระบบของเจ้าหน้าที่ ดูตัวอย่างใน .env.example",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser, remember: boolean): Promise<void> {
  const hours = remember ? REMEMBERED_HOURS : DEFAULT_HOURS;
  const token = await new SignJWT({
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    canScan: user.canScan,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // ตอนพัฒนาใช้ http จึงต้องปิด secure ไม่งั้น cookie จะไม่ถูกเก็บ
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: hours * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * อ่าน session ปัจจุบัน คืน null ถ้ายังไม่ล็อกอินหรือหมดอายุ
 *
 * ⚠️ ต้องยืนยันสิทธิ์กับฐานข้อมูลซ้ำทุกครั้ง ห้ามเชื่อค่าที่อยู่ในโทเคนอย่างเดียว
 *
 *    โทเคนมีอายุ 8–24 ชั่วโมง และแก้ไขไม่ได้หลังออกไปแล้ว ถ้าเชื่อค่าในโทเคน
 *    ล้วน ๆ เวลาผู้ดูแลปิดบัญชีเจ้าหน้าที่กลางงาน (ทำของหาย ลาออกกะทันหัน
 *    หรือลดสิทธิ์จาก admin เป็น staff) คนนั้นจะยังใช้งานต่อได้อีกจนถึงเช้าวันรุ่งขึ้น
 *    ซึ่งเป็นช่องโหว่ที่ผู้ดูแลปิดเองไม่ได้เลย
 *
 * ⚠️ ห้ามเอา cache() ของ React มาครอบฟังก์ชันนี้เด็ดขาด — เคยทำแล้วพัง
 *
 *    ฟังก์ชันนี้ไม่รับพารามิเตอร์เลย cache() จึงมองทุกคำขอเป็นอันเดียวกันหมด
 *    แล้วเอาคำตอบของคำขอหนึ่งไปตอบอีกคำขอหนึ่ง ซึ่งอันตรายสองต่อ:
 *      ① คนที่ล็อกอินแล้วถูกเด้งออก เพราะได้คำตอบของคำขอที่ยังไม่ได้ล็อกอิน
 *      ② ร้ายแรงกว่านั้นคือ session ของคนหนึ่งอาจรั่วไปให้อีกคน
 *
 *    อาการที่เจอจริง: ล็อกอินสำเร็จ ใช้หน้าเจ้าหน้าที่ได้ปกติ แต่เปิดหน้าหลังบ้าน
 *    แล้วเด้งกลับหน้าล็อกอินทุกครั้ง ทั้งที่เป็นคนเดียวกัน เครื่องเดียวกัน
 *
 *    การเรียกฐานข้อมูลซ้ำในคำขอเดียวถูกกว่าความเสี่ยงนี้มาก — เป็นการค้นด้วย
 *    primary key ที่มี index อยู่แล้ว ไม่คุ้มที่จะไปประหยัดแล้วแลกกับความปลอดภัย
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let claims: SessionUser;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    claims = {
      id: payload.sub,
      email: String(payload.email ?? ""),
      fullName: String(payload.fullName ?? ""),
      /**
       * ⚠️ ต้องอ่านทุกค่าที่มีอยู่จริง ห้ามเขียนแบบไล่เช็คทีละค่าแล้วเหมาที่เหลือเป็น staff
       *
       *    โค้ดเดิมเขียนแบบเหมา พอเพิ่มสิทธิ์ organizer เข้ามา ค่าในโทเคนของ
       *    ผู้จัดงานจึงถูกแปลงเป็น staff เงียบ ๆ ผลคือตอนฐานข้อมูลสะดุด
       *    (ทางสำรองท้ายฟังก์ชันนี้) ผู้จัดงานจะถูกเด้งออกจากหลังบ้านทั้งที่ยังมีสิทธิ์
       */
      role: ROLES.includes(payload.role as SessionUser["role"])
        ? (payload.role as SessionUser["role"])
        : "staff",
      canScan: payload.canScan === true,
    };
  } catch {
    // โทเคนหมดอายุหรือถูกแก้ไข — ถือว่ายังไม่ได้ล็อกอิน
    return null;
  }

  try {
    const [row] = await db
      .select({
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        canScan: users.canScan,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, claims.id));

    // บัญชีถูกลบหรือถูกปิดไปแล้ว — ตัดสิทธิ์ทันที ไม่ต้องรอโทเคนหมดอายุ
    if (!row) {
      // เขียน log ไว้เพราะกรณีนี้ผิดปกติ: โทเคนถูกต้องแต่ไม่มีบัญชีในฐานข้อมูล
      // มักแปลว่ากำลังต่อคนละฐานข้อมูลกับตอนที่ออกโทเคนให้
      console.warn(`[auth] โทเคนถูกต้องแต่ไม่พบบัญชี id=${claims.id} ในฐานข้อมูล`);
      return null;
    }
    if (!row.isActive) return null;

    // ใช้สิทธิ์ล่าสุดจากฐานข้อมูลเสมอ ไม่ใช่สิทธิ์ ณ วันที่ล็อกอิน
    return {
      id: claims.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      canScan: row.canScan,
    };
  } catch (error) {
    /**
     * ต่อฐานข้อมูลไม่ได้ชั่วคราว — ใช้ค่าในโทเคนไปก่อน
     *
     * ตรงนี้ไม่ได้ "เปิดประตูให้คนใหม่" เพราะโทเคนผ่านการตรวจลายเซ็นมาแล้ว
     * แต่การเด้งเจ้าหน้าที่ทั้งทีมออกจากระบบกลางงานเพราะฐานข้อมูลสะดุดไปสองวินาที
     * เสียหายมากกว่ามาก
     */
    console.error("[auth] ตรวจสอบสิทธิ์กับฐานข้อมูลไม่สำเร็จ ใช้ค่าในโทเคนแทน:", error);
    return claims;
  }
}

/**
 * สิทธิ์เข้าหน้าสแกน QR
 *
 * ตามข้อกำหนดรอบที่ 2 หัวข้อ 8.3 — Admin สแกนได้ด้วย ไม่ใช่แค่ Staff
 * ตอนคิวยาวหน้างาน ผู้จัดงานเข้ามาช่วยสแกนได้เลยโดยไม่ต้องสร้างบัญชีเพิ่ม
 */
export function canScan(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.canScan && (user.role === "admin" || user.role === "organizer" || user.role === "staff");
}

/**
 * สิทธิ์เข้าหลังบ้าน (CMS)
 *
 * ผู้ดูแลระบบและผู้จัดงานเข้าได้ ส่วนเจ้าหน้าที่หน้างานเข้าไม่ได้เลย
 * เพราะหลังบ้านมีรายชื่อผู้ลงทะเบียนพร้อมข้อมูลส่วนบุคคลครบทุกคน
 * ซึ่งเกินความจำเป็นของงานสแกนเช็คอินหน้างาน (หลักเก็บเท่าที่จำเป็นตาม PDPA)
 */
export function canOpenCms(user: SessionUser | null): boolean {
  return user?.role === "admin" || user?.role === "organizer";
}

/**
 * สิทธิ์เพิ่มหรือแก้บัญชีผู้ใช้ — เฉพาะผู้ดูแลระบบเท่านั้น
 *
 * ⚠️ นี่คือเส้นแบ่งเดียวระหว่างผู้ดูแลระบบกับผู้จัดงาน
 *    ถ้าปล่อยให้ผู้จัดงานแก้บัญชีได้ เขาจะเลื่อนสิทธิ์ตัวเองเป็นผู้ดูแลระบบได้ทันที
 *    ซึ่งเท่ากับไม่มีการแบ่งสิทธิ์เลยตั้งแต่แรก
 */
export function canManageUsers(user: SessionUser | null): boolean {
  return user?.role === "admin";
}

/**
 * ยังคงไว้เพื่อความเข้ากันได้กับโค้ดเดิม — มีความหมายเดียวกับ canManageUsers
 *
 * ⚠️ ห้ามใช้ชื่อนี้ตัดสินว่า "เข้าหลังบ้านได้ไหม" อีกต่อไป
 *    ใช้ canOpenCms() แทน ไม่งั้นผู้จัดงานจะถูกกันออกจากหลังบ้านทั้งหมด
 */
export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "admin";
}

/** ชื่อสิทธิ์ที่แสดงให้คนอ่าน — คุมไว้ที่เดียวเพื่อให้ทุกหน้าเรียกเหมือนกัน */
export const ROLE_LABEL: Record<SessionUser["role"], string> = {
  admin: "ผู้ดูแลระบบ",
  organizer: "ผู้จัดงาน",
  staff: "เจ้าหน้าที่หน้างาน",
  viewer: "ดูอย่างเดียว (ไม่ได้ใช้งานแล้ว)",
};
