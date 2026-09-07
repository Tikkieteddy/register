"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deleteMediaAction,
  updateMediaMetaAction,
  uploadMediaAction,
} from "@/app/actions/admin/media";
import { MEDIA_TYPE_INFO, MEDIA_TYPES, type MediaType } from "@/lib/admin/media-types";

export type MediaItem = {
  id: string;
  type: MediaType;
  originalUrl: string;
  webpUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  altTextTh: string | null;
  altTextEn: string | null;
  captionTh: string | null;
  sortOrder: number;
};

const FIELD =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

function formatSize(bytes: number | null): string {
  if (!bytes) return "-";
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * หน้าจัดการภาพและสื่อ (หัวข้อ 8.4)
 *
 * ทุกภาพแสดง "ใช้ที่ไหนบ้าง" ไว้ข้าง ๆ เสมอ เพราะผู้จัดงานมักไม่แน่ใจว่า
 * ภาพที่กำลังจะเปลี่ยนจะไปโผล่หน้าไหนบ้าง แล้วไม่กล้าเปลี่ยน
 */
export function MediaManager({
  eventId,
  items,
  storageName,
}: {
  eventId: string;
  items: MediaItem[];
  storageName: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<MediaType>("poster");
  const [notice, setNotice] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(
    null,
  );
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      setNotice({ ok: result.ok, text: result.message, warnings: result.warnings });
      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  const info = MEDIA_TYPE_INFO[type];

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <div
          role="status"
          className={`text-sm rounded-[var(--radius-control)] px-3 py-2 flex flex-col gap-1 ${
            notice.ok
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : "bg-danger-bg text-danger"
          }`}
        >
          <span>{notice.text}</span>
          {notice.warnings?.map((warning) => (
            <span key={warning} className="text-[var(--color-warning)]">
              ⚠️ {warning}
            </span>
          ))}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={upload}
        className="border border-line rounded-[var(--radius-card)] bg-surface p-4 flex flex-col gap-3"
      >
        <input type="hidden" name="eventId" value={eventId} />

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">ประเภทภาพ</span>
            <select
              name="type"
              className={FIELD}
              value={type}
              onChange={(e) => setType(e.target.value as MediaType)}
            >
              {MEDIA_TYPES.map((value) => (
                <option key={value} value={value}>
                  {MEDIA_TYPE_INFO[value].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">เลือกไฟล์ (JPG · PNG · WebP · SVG)</span>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              required
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-ink-2 file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-primary-light file:px-3 file:text-primary-dark file:text-xs file:font-semibold"
            />
          </label>
        </div>

        <p className="text-xs text-muted">
          <strong className="text-ink-2">{info.label}</strong> · ใช้ที่ {info.usedAt} · ขนาดที่แนะนำ{" "}
          {info.size}
          <span className="block mt-0.5">
            ระบบจะแปลงเป็น WebP และ AVIF พร้อมย่อขนาด 400 / 800 / 1200 px ให้อัตโนมัติ
          </span>
        </p>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 px-5 self-start rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "กำลังอัปโหลดและแปลงไฟล์…" : "อัปโหลด"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีภาพในระบบ</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <figure
              key={item.id}
              className="border border-line rounded-[var(--radius-card)] bg-surface overflow-hidden flex flex-col"
            >
              <div className="bg-surface-2 aspect-[4/3] grid place-items-center overflow-hidden">
                {/* ใช้ img ธรรมดาเพราะไฟล์อยู่บนที่เก็บภายนอกที่ตั้งค่าได้ */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.webpUrl ?? item.originalUrl}
                  alt={item.altTextTh ?? MEDIA_TYPE_INFO[item.type].label}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <figcaption className="p-3 flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-primary-dark bg-primary-light rounded-full px-2 py-0.5">
                    {MEDIA_TYPE_INFO[item.type].label}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                    {formatSize(item.sizeBytes)}
                  </span>
                </div>

                <p className="text-xs text-muted">ใช้ที่ {MEDIA_TYPE_INFO[item.type].usedAt}</p>

                {item.altTextTh ? (
                  <p className="text-xs text-ink-2">คำอธิบายภาพ: {item.altTextTh}</p>
                ) : (
                  <p className="text-xs text-[var(--color-warning)]">
                    ⚠️ ยังไม่มีคำอธิบายภาพ — จำเป็นต่อคะแนนการเข้าถึง (Accessibility)
                  </p>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="min-h-9 px-3 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                  >
                    แก้ไขคำอธิบาย
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("นำภาพนี้ออกจากระบบ?")) return;
                      startTransition(async () => {
                        const result = await deleteMediaAction(item.id);
                        setNotice({ ok: result.ok, text: result.message });
                        router.refresh();
                      });
                    }}
                    className="min-h-9 px-3 rounded-[var(--radius-control)] border border-line text-xs text-muted hover:bg-surface-2 disabled:opacity-50"
                  >
                    นำออก
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await updateMediaMetaAction({
                id: editing.id,
                altTextTh: String(data.get("altTextTh") ?? ""),
                altTextEn: String(data.get("altTextEn") ?? ""),
                captionTh: String(data.get("captionTh") ?? ""),
                sortOrder: Number(data.get("sortOrder") ?? 0),
              });
              setNotice({ ok: result.ok, text: result.message });
              if (result.ok) {
                setEditing(null);
                router.refresh();
              }
            });
          }}
          className="border border-primary rounded-[var(--radius-card)] bg-primary-light/40 p-4 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-ink">
            คำอธิบายภาพ · {MEDIA_TYPE_INFO[editing.type].label}
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">คำอธิบายภาพ ภาษาไทย (alt text)</span>
              <input name="altTextTh" defaultValue={editing.altTextTh ?? ""} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">คำอธิบายภาพ ภาษาอังกฤษ</span>
              <input name="altTextEn" defaultValue={editing.altTextEn ?? ""} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">คำบรรยายใต้ภาพ</span>
              <input name="captionTh" defaultValue={editing.captionTh ?? ""} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">ลำดับการแสดง (ตัวเลขน้อยขึ้นก่อน)</span>
              <input
                name="sortOrder"
                type="number"
                defaultValue={editing.sortOrder}
                className={FIELD}
              />
            </label>
          </div>

          <p className="text-xs text-muted">
            คำอธิบายภาพคือข้อความที่โปรแกรมอ่านหน้าจอใช้บอกผู้พิการทางสายตาว่าภาพนี้คืออะไร
            และจะแสดงแทนภาพเมื่อโหลดภาพไม่ขึ้น
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : null}

      <p className="text-xs text-muted">
        ที่เก็บไฟล์ที่ใช้อยู่: <strong className="text-ink-2">{storageName}</strong>
        {storageName === "local-disk"
          ? " — โหมดพัฒนาในเครื่องเท่านั้น บนเครื่องจริงต้องตั้งค่า Cloudflare R2 ไม่งั้นไฟล์จะหายทุกครั้งที่ deploy"
          : ""}
      </p>
    </div>
  );
}
