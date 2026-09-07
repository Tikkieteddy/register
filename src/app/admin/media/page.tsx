import { asc, eq } from "drizzle-orm";
import { MediaManager, type MediaItem } from "@/components/admin/MediaManager";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getAdminEvent } from "@/lib/admin/current-event";
import { requireAdmin } from "@/lib/admin/guard";
import type { MediaType } from "@/lib/admin/media-types";
import { getStorage } from "@/lib/storage";

export const metadata = { title: "ภาพและสื่อ" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireAdmin();
  const event = await getAdminEvent();
  if (!event) return <p className="text-sm text-muted">ยังไม่มีงานในระบบ</p>;

  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.eventId, event.id))
    .orderBy(asc(mediaAssets.type), asc(mediaAssets.sortOrder));

  const items: MediaItem[] = rows.map((row) => ({
    id: row.id,
    type: row.type as MediaType,
    originalUrl: row.originalUrl,
    webpUrl: row.webpUrl,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    altTextTh: row.altTextTh,
    altTextEn: row.altTextEn,
    captionTh: row.captionTh,
    sortOrder: row.sortOrder,
  }));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink">ภาพและสื่อ</h1>
        <p className="text-sm text-muted">
          อัปโหลดโลโก้ โปสเตอร์ แบนเนอร์ และภาพประกอบ — ระบบบีบอัดและแปลงรูปแบบให้อัตโนมัติ
        </p>
      </header>

      <MediaManager eventId={event.id} items={items} storageName={getStorage().name} />
    </div>
  );
}
