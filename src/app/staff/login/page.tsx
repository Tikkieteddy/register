import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/staff/LoginForm";
import { Card, CardBody } from "@/components/ui/Card";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "เข้าสู่ระบบเจ้าหน้าที่" };

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getSession();
  // ป้องกัน open redirect — รับเฉพาะ path ภายในเว็บเท่านั้น
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/staff";

  if (session) redirect(target);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <div
            className="mx-auto size-14 rounded-[var(--radius-card)] bg-primary flex items-center justify-center text-2xl"
            aria-hidden="true"
          >
            🎫
          </div>
          <h1 className="mt-3 text-xl font-semibold text-ink">เข้าสู่ระบบเจ้าหน้าที่</h1>
          <p className="text-sm text-muted mt-1">สำหรับเจ้าหน้าที่หน้างานและผู้ดูแลระบบ</p>
        </div>

        <Card>
          <CardBody>
            <LoginForm redirectTo={target} />
          </CardBody>
        </Card>

        <p className="text-xs text-muted text-center">
          ลืมรหัสผ่าน หรือบัญชีถูกล็อก กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}
