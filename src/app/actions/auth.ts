"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, type SessionUser } from "@/lib/auth/session";
import { hashIdentifier } from "@/lib/hash";
import { getClientIp } from "@/lib/tracking";

/**
 * เข้าสู่ระบบสำหรับเจ้าหน้าที่และผู้ดูแล
 *
 * ⚠️ ล็อกบัญชี 15 นาทีเมื่อล็อกอินผิด 5 ครั้ง เพื่อกันการเดารหัสผ่าน
 *    และไม่บอกว่าผิดที่อีเมลหรือรหัสผ่าน เพื่อไม่ให้เดาได้ว่าอีเมลไหนมีอยู่จริง
 */
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type LoginResult = { ok: true } | { ok: false; message: string };

export async function loginAction(input: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const generic = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

  if (!email || !input.password) {
    return { ok: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  const h = await headers();
  const ip = getClientIp(h);
  const ipHash = ip ? hashIdentifier(ip) : null;

  async function logAttempt(action: string, userId: string | null) {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType: "user",
      entityId: userId,
      ipHash,
    });
  }

  if (!user) {
    // แฮชหลอกเพื่อให้เวลาตอบกลับใกล้เคียงกับกรณีที่มีบัญชีจริง
    // ไม่งั้นผู้โจมตีจะเดาได้จากเวลาตอบว่าอีเมลไหนมีอยู่ในระบบ
    await verifyPassword(input.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    await logAttempt("login_failed_unknown_email", null);
    return { ok: false, message: generic };
  }

  if (!user.isActive) {
    await logAttempt("login_failed_inactive", user.id);
    return { ok: false, message: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await logAttempt("login_failed_locked", user.id);
    return {
      ok: false,
      message: `บัญชีถูกล็อกชั่วคราวจากการกรอกรหัสผ่านผิดหลายครั้ง กรุณารออีก ${minutesLeft} นาที`,
    };
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);

  if (!passwordOk) {
    const failed = user.failedLoginCount + 1;
    const shouldLock = failed >= MAX_FAILED;
    await db
      .update(users)
      .set({
        failedLoginCount: failed,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await logAttempt("login_failed_password", user.id);
    return {
      ok: false,
      message: shouldLock
        ? `กรอกรหัสผ่านผิดครบ ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`
        : generic,
    };
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    canScan: user.canScan,
  };
  await createSession(sessionUser, input.remember);
  await logAttempt("login", user.id);

  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}
