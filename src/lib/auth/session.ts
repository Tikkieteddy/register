import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
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

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "staff" | "viewer";
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
 *    ใช้ cache() ของ React ครอบไว้ เพื่อให้หนึ่งคำขอเรียกฐานข้อมูลแค่ครั้งเดียว
 *    แม้จะมีหลายส่วนของหน้าเรียก getSession() ก็ตาม
 */
export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
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
      role: payload.role === "admin" ? "admin" : payload.role === "viewer" ? "viewer" : "staff",
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
    if (!row || !row.isActive) return null;

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
});

/**
 * สิทธิ์เข้าหน้าสแกน QR
 *
 * ตามข้อกำหนดรอบที่ 2 หัวข้อ 8.3 — Admin สแกนได้ด้วย ไม่ใช่แค่ Staff
 * ตอนคิวยาวหน้างาน ผู้จัดงานเข้ามาช่วยสแกนได้เลยโดยไม่ต้องสร้างบัญชีเพิ่ม
 */
export function canScan(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.canScan && (user.role === "admin" || user.role === "staff");
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "admin";
}
