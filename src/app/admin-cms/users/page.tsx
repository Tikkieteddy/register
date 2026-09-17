import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { UsersPanel, type UserRow } from "@/components/admin/settings/UsersPanel";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/guard";
import { canManageUsers } from "@/lib/auth/session";
import { formatThaiDate, formatTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "ผู้ใช้งาน" };
export const dynamic = "force-dynamic";

/**
 * หน้าจัดการบัญชีผู้ใช้ของระบบ
 *
 * เดิมซ่อนอยู่เป็นแท็บที่ 4 ในหน้า "ตั้งค่างาน" ซึ่งผิดที่ เพราะบัญชีผู้ใช้
 * ไม่ได้ผูกกับงานใดงานหนึ่ง — คนคนเดียวกันดูแลได้ทุกงานในระบบ
 * การซ่อนไว้ในหน้าตั้งค่าของงานจึงทำให้เข้าใจผิดว่าต้องตั้งใหม่ทุกงาน
 *
 * ⚠️ หน้านี้ผู้จัดงานเปิดดูได้ แต่แก้ไม่ได้ (ดูเหตุผลที่ canManageUsers)
 *    ตัวกันจริงอยู่ที่ saveUserAction ฝั่งเซิร์ฟเวอร์ ไม่ใช่การซ่อนปุ่มตรงนี้
 */
export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const editable = canManageUsers(me);

  const rows = await db.select().from(users).orderBy(asc(users.email));
  const now = new Date();

  const list: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    canScan: u.canScan,
    isActive: u.isActive,
    isLocked: Boolean(u.lockedUntil && u.lockedUntil > now),
    lastLoginLabel: u.lastLoginAt
      ? `${formatThaiDate(u.lastLoginAt)} ${formatTime(u.lastLoginAt)}`
      : "ยังไม่เคยเข้าระบบ",
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-ink">ผู้ใช้งาน</h1>
        <p className="text-sm text-muted">
          บัญชีเจ้าหน้าที่ของทั้งระบบ ใช้ได้กับทุกงาน ไม่ต้องตั้งใหม่ทุกครั้งที่สร้างงาน
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">สิทธิ์แต่ละระดับทำอะไรได้บ้าง</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-line rounded-[var(--radius-card)] overflow-hidden">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="text-start p-3 font-semibold">สิทธิ์</th>
                <th className="text-start p-3 font-semibold">หลังบ้าน</th>
                <th className="text-start p-3 font-semibold">จัดการบัญชีผู้ใช้</th>
                <th className="text-start p-3 font-semibold">สแกนหน้างาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              <RoleRow name="ผู้ดูแลระบบ" cms="ได้ทั้งหมด" manageUsers="ได้" scan="ได้" />
              <RoleRow name="ผู้จัดงาน" cms="ได้ทั้งหมด" manageUsers="ดูได้ แก้ไม่ได้" scan="ได้" />
              <RoleRow
                name="เจ้าหน้าที่หน้างาน"
                cms="เข้าไม่ได้เลย"
                manageUsers="ไม่ได้"
                scan="ได้"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* คำเตือนเรื่อง 2FA และการปิดบัญชีอยู่ท้าย UsersPanel อยู่แล้ว ไม่ต้องเขียนซ้ำที่นี่ */}
      <UsersPanel users={list} currentUserId={me.id} readOnly={!editable} />
    </div>
  );
}

function RoleRow({
  name,
  cms,
  manageUsers,
  scan,
}: {
  name: string;
  cms: string;
  manageUsers: string;
  scan: string;
}) {
  return (
    <tr>
      <td className="p-3 font-semibold text-ink">{name}</td>
      <td className="p-3 text-ink-2">{cms}</td>
      <td className="p-3 text-ink-2">{manageUsers}</td>
      <td className="p-3 text-ink-2">{scan}</td>
    </tr>
  );
}
