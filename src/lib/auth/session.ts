import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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

/** อ่าน session ปัจจุบัน คืน null ถ้ายังไม่ล็อกอินหรือหมดอายุ */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
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
}

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
