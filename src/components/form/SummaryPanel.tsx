"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";

/** แปลงวินาทีเป็น 00:14:44 (ชม.:นาที:วินาที) ตามรูปแบบในภาพอ้างอิง */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(totalSeconds, 0);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * แถบสรุปด้านขวา (sticky) และแถบลอยขอบล่างจอบนมือถือ
 * ตามข้อกำหนด D3 และภาพอ้างอิงที่ 2, 3, 5
 */
export function SummaryPanel({
  dict,
  expiresAt,
  onExpire,
  acceptedTerms,
  onAcceptTerms,
  termsError,
  canSubmit,
  submitting,
  onSubmit,
  privacyHref = "/privacy",
  termsHref = "/terms",
}: {
  dict: Dictionary;
  /** เวลาหมดอายุการจองที่นั่ง — null แปลว่ายังไม่ได้เลือกช่วงเวลา นาฬิกายังไม่เริ่มเดิน */
  expiresAt: Date | null;
  onExpire: () => void;
  acceptedTerms: boolean;
  onAcceptTerms: (v: boolean) => void;
  termsError?: string;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  privacyHref?: string;
  termsHref?: string;
}) {
  // เก็บแค่ "เวลาปัจจุบัน" เป็น state แล้วคำนวณวินาทีที่เหลือตอน render
  // วิธีนี้ทำให้ไม่ต้องรีเซ็ต state ตอน expiresAt เปลี่ยนเป็น null
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const secondsLeft = expiresAt ? Math.floor((expiresAt.getTime() - now) / 1000) : null;
  const isExpired = secondsLeft !== null && secondsLeft <= 0;

  useEffect(() => {
    if (isExpired) onExpire();
  }, [isExpired, onExpire]);

  // เหลือน้อยกว่า 2 นาที ตัวเลขเปลี่ยนเป็นสีแดงตามข้อกำหนด D3
  const urgent = secondsLeft !== null && secondsLeft <= 120;

  const clock =
    secondsLeft === null ? null : (
      <span
        className={`font-mono text-sm tabular-nums ${urgent ? "text-danger font-semibold" : "text-primary-dark"}`}
        aria-live={urgent ? "polite" : "off"}
      >
        <span aria-hidden="true">⏰</span> {formatCountdown(secondsLeft)}
        <span className="sr-only"> {dict.summary.timeLeft}</span>
      </span>
    );

  const termsLabel = (
    <>
      {dict.summary.acceptTerms.split(/\{terms\}|\{privacy\}/).map((part, i) => (
        <span key={i}>
          {part}
          {i === 0 && (
            <a href={termsHref} target="_blank" rel="noopener noreferrer" className="text-primary-dark font-semibold underline">
              {dict.landing.terms}
            </a>
          )}
          {i === 1 && (
            <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="text-primary-dark font-semibold underline">
              {dict.landing.privacyPolicy}
            </a>
          )}
        </span>
      ))}
    </>
  );

  return (
    <>
      {/* ---------- เดสก์ท็อป: กล่องสรุปติดหน้าจอ ---------- */}
      <aside className="hidden lg:flex flex-col gap-4 sticky top-20 self-start w-full">
        <div className="bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">{dict.summary.title}</h2>
            {clock}
          </div>
          <p className="text-sm text-primary-dark font-medium">{dict.summary.ticket}</p>
          <div className="flex justify-between text-sm text-ink-2 border-b border-line pb-3">
            <span>{dict.summary.ticketLine}</span>
            <span>{dict.summary.free}</span>
          </div>
          <div className="flex justify-between bg-primary-light text-primary-dark font-semibold rounded-[var(--radius-control)] px-4 py-2.5">
            <span>{dict.summary.total}</span>
            <span>{dict.summary.totalFree}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {termsError && (
            <p role="alert" className="text-danger text-sm">
              {termsError}
            </p>
          )}
          <label className="flex items-start gap-2.5 cursor-pointer text-sm text-ink-2 leading-relaxed">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => onAcceptTerms(e.target.checked)}
              className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span>{termsLabel}</span>
          </label>
          <Button fullWidth onClick={onSubmit} disabled={!canSubmit} loading={submitting}>
            {submitting ? dict.summary.submitting : dict.summary.submit}
          </Button>
        </div>
      </aside>

      {/* ---------- มือถือ: แถบลอยติดขอบล่างจอ ---------- */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line-strong px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgba(28,23,20,0.08)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-primary-dark">
            {dict.summary.total} {dict.summary.totalFree}
          </span>
          {clock}
        </div>
        {termsError && (
          <p role="alert" className="text-danger text-xs mb-1.5">
            {termsError}
          </p>
        )}
        <label className="flex items-start gap-2 cursor-pointer text-xs text-ink-2 leading-snug mb-2.5">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => onAcceptTerms(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span>{termsLabel}</span>
        </label>
        <Button fullWidth onClick={onSubmit} disabled={!canSubmit} loading={submitting}>
          {submitting ? dict.summary.submitting : dict.summary.submit}
        </Button>
      </div>
    </>
  );
}
