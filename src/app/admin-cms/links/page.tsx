import { LinkManager } from "@/components/admin/LinkManager";
import { getLinkStats } from "@/lib/admin/analytics";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import { clientEnv } from "@/lib/env";

export const metadata = { title: "ลิงก์ติดตามผล" };
export const dynamic = "force-dynamic";

export default async function LinksPage() {
  await requireAdmin();
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const links = await getLinkStats(event.id);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">ลิงก์ติดตามผล</h1>
        <p className="text-sm text-muted">
          สร้างลิงก์สั้นแยกช่องทาง ดาวน์โหลด QR และดูว่าช่องทางไหนพาคนมาลงทะเบียนได้จริง
        </p>
      </header>

      <LinkManager eventId={event.id} siteUrl={clientEnv.NEXT_PUBLIC_SITE_URL} links={links} />
    </div>
  );
}
