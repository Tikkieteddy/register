"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectEventAction } from "@/app/actions/admin/event";
import type { AdminEventOption } from "@/lib/admin/current-event";

/**
 * ตัวสลับงานที่กำลังจัดการ
 *
 * ⚠️ ต้องเรียก server action ไม่ใช่แค่ลิงก์ไป ?event=<slug>
 *    เพราะงานที่เลือกถูกจำไว้ในคุกกี้เพื่อให้ทุกหน้าในหลังบ้านเห็นตรงกัน
 *    ถ้าใช้แค่พารามิเตอร์ใน URL พอกดไปหน้าอื่นก็จะเด้งกลับไปงานเดิมทันที
 */
export function EventSwitcher({
  events,
  currentSlug,
}: {
  events: AdminEventOption[];
  currentSlug: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // มีงานเดียวก็ไม่ต้องมีตัวเลือกให้รก
  if (events.length < 2) return null;

  return (
    <label className="flex flex-col gap-1" data-tour="cms-event-switcher">
      <span className="text-xs text-muted">งานที่กำลังจัดการ</span>
      <select
        value={currentSlug ?? ""}
        disabled={pending}
        onChange={(e) => {
          const slug = e.target.value;
          startTransition(async () => {
            await selectEventAction(slug);
            router.refresh();
          });
        }}
        className="w-full min-h-11 px-2 rounded-[var(--radius-control)] border border-line-strong
          bg-surface text-ink text-sm focus:border-primary focus:outline-none disabled:opacity-60"
      >
        {events.map((event) => (
          <option key={event.id} value={event.slug}>
            {event.nameTh}
            {event.status === "draft" ? " (ฉบับร่าง)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
