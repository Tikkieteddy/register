import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminEvent, listAdminEvents } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { default: "หลังบ้านผู้ดูแล", template: "%s · หลังบ้านผู้ดูแล" },
  // หน้าหลังบ้านมีข้อมูลส่วนบุคคล ห้ามให้ search engine เก็บเด็ดขาด
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [event, allEvents] = await Promise.all([getAdminEvent(), listAdminEvents()]);

  return (
    <AdminShell
      userName={user.fullName}
      eventName={event?.nameTh ?? "ยังไม่มีงานในระบบ"}
      events={allEvents}
      currentSlug={event?.slug ?? null}
    >
      {children}
    </AdminShell>
  );
}
