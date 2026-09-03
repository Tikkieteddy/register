"use client";

import { useState } from "react";

/**
 * ปุ่มแชร์ตามข้อกำหนดรอบที่ 2 หัวข้อ 8.5
 *
 * ทุกครั้งที่กด ระบบบันทึกลง link_events ว่าแชร์ไปแพลตฟอร์มไหน จากหน้าไหน
 * เพื่อนำไปทำกราฟที่ 10 และวัดว่าการบอกต่อพาคนมาลงทะเบียนได้จริงแค่ไหน
 *
 * LINE สำคัญที่สุดสำหรับผู้ใช้ไทย จึงวางไว้ลำดับต้น ๆ (คำตอบ Q25)
 */
const PLATFORMS = [
  { key: "facebook", label: "Facebook", icon: "f" },
  { key: "line", label: "LINE", icon: "L" },
  { key: "x", label: "X", icon: "X" },
] as const;

export function ShareButtons({
  eventId,
  url,
  title,
  sourcePage,
  label,
  copiedLabel,
}: {
  eventId: string;
  url: string;
  title: string;
  sourcePage: "landing" | "thankyou";
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  /** บันทึกการแชร์แบบไม่บล็อกผู้ใช้ — ถ้าบันทึกไม่ได้ก็ยังแชร์ได้ตามปกติ */
  function track(platform: string) {
    const body = JSON.stringify({ eventId, action: "share", platform, sourcePage });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      // ไม่ต้องทำอะไร — ตกไปใช้ fetch ด้านล่างแทน
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  function shareTo(platform: (typeof PLATFORMS)[number]["key"]) {
    track(platform);
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const target =
      platform === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${u}`
        : platform === "line"
          ? `https://social-plugins.line.me/lineit/share?url=${u}&text=${t}`
          : `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    window.open(target, "_blank", "noopener,noreferrer,width=600,height=600");
  }

  async function copyLink() {
    track("copy");
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // เบราว์เซอร์บางตัวไม่อนุญาต clipboard — ยังถือว่าผู้ใช้เห็นลิงก์แล้ว
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted me-1">{label}</span>
      {PLATFORMS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => shareTo(p.key)}
          aria-label={`แชร์ไปยัง ${p.label}`}
          className="size-10 rounded-full border border-line-strong bg-surface text-ink-2
            hover:border-primary hover:text-primary-dark transition-colors font-semibold"
        >
          {p.icon}
        </button>
      ))}
      <button
        type="button"
        onClick={copyLink}
        className="min-h-10 px-4 rounded-[var(--radius-pill)] border border-line-strong bg-surface
          text-sm text-ink-2 hover:border-primary hover:text-primary-dark transition-colors"
      >
        {copied ? `✓ ${copiedLabel}` : "คัดลอกลิงก์"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  );
}
