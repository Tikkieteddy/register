/**
 * ตั้งรหัสผ่านให้บัญชีเจ้าหน้าที่หรือผู้ดูแล
 *
 * รันด้วย: npx tsx scripts/set-password.ts <อีเมล> <รหัสผ่าน>
 * ตัวอย่าง: npx tsx scripts/set-password.ts admin@example.com "รหัสผ่านที่ปลอดภัย"
 *
 * ⚠️ อย่าใส่รหัสผ่านจริงลงในไฟล์ใด ๆ ของโปรเจกต์
 *    และเปลี่ยนรหัสผ่านของบัญชีตัวอย่างก่อนขึ้นใช้งานจริงเสมอ
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error("วิธีใช้: npx tsx scripts/set-password.ts <อีเมล> <รหัสผ่าน>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    process.exit(1);
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    console.error(`ไม่พบบัญชีอีเมล ${email}`);
    process.exit(1);
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      failedLoginCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(`✅ ตั้งรหัสผ่านให้ ${email} เรียบร้อย`);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error("❌ ตั้งรหัสผ่านไม่สำเร็จ:", e);
  process.exit(1);
});
