import Link from "next/link";
import { NewRegistrationForm } from "@/components/admin/NewRegistrationForm";
import { db } from "@/db";
import { eventSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata = { title: "เพิ่มผู้ลงทะเบียนด้วยมือ" };
export const dynamic = "force-dynamic";

export default async function NewRegistrationPage() {
  await requireAdmin();
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const sessions = await db
    .select({
      id: eventSessions.id,
      nameTh: eventSessions.nameTh,
      quota: eventSessions.quota,
      reservedCount: eventSessions.reservedCount,
    })
    .from(eventSessions)
    .where(eq(eventSessions.eventId, event.id))
    .orderBy(eventSessions.sortOrder);

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm">
        <Link href="/admin/registrations" className="text-primary-dark hover:underline">
          ← กลับไปรายชื่อผู้ลงทะเบียน
        </Link>
      </nav>

      <header>
        <h1 className="text-xl font-bold text-ink">เพิ่มผู้ลงทะเบียนด้วยมือ</h1>
        <p className="text-sm text-muted">
          สำหรับแขก VIP หรือผู้ที่โทรมาลงทะเบียนทางโทรศัพท์
        </p>
      </header>

      <NewRegistrationForm
        eventId={event.id}
        sessions={sessions.map((s) => ({
          id: s.id,
          nameTh: s.nameTh,
          remaining: Math.max(s.quota - s.reservedCount, 0),
        }))}
      />
    </div>
  );
}
