"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveShareLinkAction, toggleShareLinkAction } from "@/app/actions/admin/links";
import type { LinkStat } from "@/lib/admin/analytics";

const FIELD =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

type Draft = {
  id?: string;
  code: string;
  label: string;
  channel: string;
  medium: string;
  campaign: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  code: "",
  label: "",
  channel: "",
  medium: "social",
  campaign: "",
  isActive: true,
};

/**
 * จัดการลิงก์ติดตามผล (หัวข้อ 8.5)
 *
 * ตารางเรียงตามยอดลงทะเบียนสำเร็จ ไม่ใช่ยอดคลิก
 * เพราะคำถามที่ผู้จัดงานต้องการคำตอบคือ "ลิงก์ไหนพาคนมาลงทะเบียนได้จริง"
 * ไม่ใช่ "ลิงก์ไหนคนกดเยอะ"
 */
export function LinkManager({
  eventId,
  siteUrl,
  links,
}: {
  eventId: string;
  siteUrl: string;
  links: LinkStat[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      const result = await saveShareLinkAction({ eventId, ...draft });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) {
        setDraft(null);
        router.refresh();
      }
    });
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${siteUrl}/r/${code}`);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setNotice({ ok: false, text: "คัดลอกไม่สำเร็จ — กรุณาคัดลอกจากช่องด้วยตัวเอง" });
    }
  }

  const best = links.reduce<LinkStat | null>(
    (top, link) => (!top || link.conversionRate > top.conversionRate ? link : top),
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <p
          role="status"
          className={`text-sm rounded-[var(--radius-control)] px-3 py-2 ${
            notice.ok
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : "bg-danger-bg text-danger"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {best && best.clicks > 0
            ? `ลิงก์ที่คุ้มที่สุดตอนนี้คือ “${best.label}” — อัตราแปลง ${best.conversionRate}%`
            : "ยังไม่มีข้อมูลพอจะบอกว่าลิงก์ไหนคุ้มที่สุด"}
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft({ ...EMPTY });
            setErrors({});
          }}
          className="min-h-11 px-4 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark"
        >
          สร้างลิงก์ใหม่
        </button>
      </div>

      {draft ? (
        <form
          onSubmit={save}
          className="border border-primary rounded-[var(--radius-card)] bg-primary-light/40 p-4 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-ink">
            {draft.id ? "แก้ไขลิงก์" : "สร้างลิงก์ติดตามผลใหม่"}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">รหัสลิงก์ (ต่อท้าย /r/)</span>
              <input
                className={FIELD}
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="fb01"
              />
              {errors.code ? <span className="text-xs text-danger">{errors.code}</span> : null}
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-muted">ชื่อที่เข้าใจได้</span>
              <input
                className={FIELD}
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="โพสต์ Facebook วันที่ 1"
              />
              {errors.label ? <span className="text-xs text-danger">{errors.label}</span> : null}
            </label>

            {(
              [
                ["channel", "ช่องทาง (utm_source)", "facebook"],
                ["medium", "ประเภทสื่อ (utm_medium)", "social"],
                ["campaign", "แคมเปญ (utm_campaign)", "tnn-event-2026"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs text-muted">{label}</span>
                <input
                  className={FIELD}
                  value={draft[key]}
                  placeholder={placeholder}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
            <span className="text-ink-2">เปิดใช้งานลิงก์นี้</span>
          </label>

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
              onClick={() => setDraft(null)}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-line text-ink-2 text-sm hover:bg-surface-2"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto border border-line rounded-[var(--radius-card)] bg-surface">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">ลิงก์</th>
              <th className="p-3 font-medium text-right">คลิก</th>
              <th className="p-3 font-medium text-right">ผู้ใช้ไม่ซ้ำ</th>
              <th className="p-3 font-medium text-right">เริ่มกรอกฟอร์ม</th>
              <th className="p-3 font-medium text-right">ลงทะเบียน</th>
              <th className="p-3 font-medium text-right">อัตราแปลง</th>
              <th className="p-3 font-medium text-right">มาจริง</th>
              <th className="p-3 font-medium text-right">แชร์ต่อ</th>
              <th className="p-3 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  ยังไม่มีลิงก์ติดตามผล — สร้างก่อนเริ่มโปรโมท เพราะข้อมูลเก็บย้อนหลังไม่ได้
                </td>
              </tr>
            ) : (
              links.map((link) => (
                <tr
                  key={link.id}
                  className={`border-b border-line last:border-0 ${link.isActive ? "" : "opacity-55"}`}
                >
                  <td className="p-3">
                    <span className="text-ink font-medium">{link.label}</span>
                    <span className="block text-xs text-muted break-all">
                      {siteUrl}/r/{link.code}
                      {link.isActive ? "" : " · ปิดอยู่"}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{link.clicks}</td>
                  <td className="p-3 text-right tabular-nums">{link.uniqueVisitors}</td>
                  <td className="p-3 text-right tabular-nums">{link.viewForm}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{link.conversions}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-primary-dark">
                    {link.conversionRate}%
                  </td>
                  <td className="p-3 text-right tabular-nums">{link.attended}</td>
                  <td className="p-3 text-right tabular-nums">{link.shares}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => copy(link.code)}
                        className="min-h-9 px-2.5 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                      >
                        {copied === link.code ? "คัดลอกแล้ว" : "คัดลอก"}
                      </button>
                      <a
                        href={`/api/admin/link-qr?id=${link.id}&format=png`}
                        className="min-h-9 inline-flex items-center px-2.5 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                      >
                        QR PNG
                      </a>
                      <a
                        href={`/api/admin/link-qr?id=${link.id}&format=svg`}
                        className="min-h-9 inline-flex items-center px-2.5 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                      >
                        QR SVG
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            id: link.id,
                            code: link.code,
                            label: link.label,
                            channel: link.channel ?? "",
                            medium: "",
                            campaign: "",
                            isActive: link.isActive,
                          });
                          setErrors({});
                        }}
                        className="min-h-9 px-2.5 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await toggleShareLinkAction(link.id, !link.isActive);
                            setNotice({ ok: result.ok, text: result.message });
                            router.refresh();
                          })
                        }
                        className="min-h-9 px-2.5 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                      >
                        {link.isActive ? "ปิด" : "เปิด"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        ระบบไม่มีปุ่มลบลิงก์โดยตั้งใจ — การลบจะทำให้ผู้ลงทะเบียนที่มาจากลิงก์นั้นกลายเป็น
        “ไม่ทราบที่มา” และรายงานย้อนหลังจะเพี้ยน ใช้ปุ่ม “ปิด” แทนเพื่อรักษาสถิติเดิมไว้
      </p>
    </div>
  );
}
