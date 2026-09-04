"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkInByTokenAction,
  getCheckInStatsAction,
  recordBadgePrintAction,
  type CheckInResult,
  type CheckInStats,
} from "@/app/actions/checkin";
import { downloadAttendeesAction } from "@/app/actions/staff-sync";
import { QrScanner } from "./QrScanner";
import { ScanResult } from "./ScanResult";
import { ConnectionBar, useOnlineSync } from "./useOnlineSync";
import {
  countAttendees,
  getAttendee,
  getDeviceId,
  markCheckedInLocally,
  saveAttendees,
} from "@/lib/offline/db";
import { playFeedback, primeAudio } from "@/lib/offline/feedback";
import { enqueueCheckIn } from "@/lib/offline/queue-store";

/**
 * หน้าสแกน QR ของเจ้าหน้าที่ ตามข้อกำหนด B1
 *
 * ทำงานได้ทั้งออนไลน์และออฟไลน์:
 *   ออนไลน์  → ตรวจ token ที่เซิร์ฟเวอร์แล้วบันทึกทันที
 *   ออฟไลน์  → ตรวจกับรายชื่อใน IndexedDB แล้วเข้าคิวรอ sync
 */
export function ScanScreen({
  eventSlug,
  staffName,
  initialStats,
}: {
  eventSlug: string;
  staffName: string;
  initialStats: CheckInStats | null;
}) {
  const router = useRouter();
  const { state, online, pendingCount, lastSync, sync, refreshCounts } = useOnlineSync();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState<CheckInStats | null>(initialStats);
  const [localCount, setLocalCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [printing, setPrinting] = useState<{ qrToken: string; format: string } | null>(null);

  /** กันสแกน token เดิมซ้ำรัว ๆ ภายในไม่กี่วินาที */
  const lastScannedRef = useRef<{ token: string; at: number } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    void countAttendees().then(setLocalCount);
  }, []);

  // อัปเดตตัวนับผู้เช็คอินแบบสด ตามข้อกำหนด B1
  const refreshStats = useCallback(async () => {
    if (!navigator.onLine) return;
    const next = await getCheckInStatsAction(eventSlug);
    if (next) setStats(next);
  }, [eventSlug]);

  useEffect(() => {
    const id = window.setInterval(() => void refreshStats(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  const handleScan = useCallback(
    async (text: string) => {
      if (busyRef.current) return;

      const token = text.trim();
      const previous = lastScannedRef.current;
      if (previous && previous.token === token && Date.now() - previous.at < 3000) return;
      lastScannedRef.current = { token, at: Date.now() };

      busyRef.current = true;
      primeAudio();

      try {
        if (navigator.onLine) {
          const outcome = await checkInByTokenAction({ qrToken: token, deviceId: getDeviceId() });
          setResult(outcome);
          playFeedback(
            outcome.status === "success"
              ? "success"
              : outcome.status === "duplicate"
                ? "duplicate"
                : "invalid",
          );
          if (outcome.status === "success") {
            await markCheckedInLocally(token);
            void refreshStats();
          }
          return;
        }

        // ---------- โหมดออฟไลน์ ----------
        const attendee = await getAttendee(token);
        if (!attendee) {
          setResult({
            status: "invalid",
            reason: "ไม่พบใน​รายชื่อที่ดาวน์โหลดไว้ — อาจเป็นผู้ที่ลงทะเบียนหลังจากดาวน์โหลด",
          });
          playFeedback("invalid");
          return;
        }

        if (attendee.checkedIn) {
          setResult({
            status: "duplicate",
            person: {
              registrationId: "",
              ticketId: "",
              firstName: attendee.firstName,
              lastName: attendee.lastName,
              occupation: attendee.occupation,
              registrationCode: attendee.registrationCode,
              sessionNames: attendee.sessionNames,
            },
            checkedInAt: new Date().toISOString(),
            byStaffName: null,
            minutesAgo: 0,
          });
          playFeedback("duplicate");
          return;
        }

        const checkedInAt = new Date().toISOString();
        await enqueueCheckIn({ qrToken: token, checkedInAt, deviceId: getDeviceId(), method: "qr" });
        await markCheckedInLocally(token);
        await refreshCounts();

        setResult({
          status: "success",
          person: {
            registrationId: "",
            ticketId: "",
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            occupation: attendee.occupation,
            registrationCode: attendee.registrationCode,
            sessionNames: attendee.sessionNames,
          },
          checkedInAt,
        });
        playFeedback("success");
      } finally {
        busyRef.current = false;
      }
    },
    [refreshStats, refreshCounts],
  );

  async function handleDownload() {
    setDownloading(true);
    setNotice(null);
    try {
      const list = await downloadAttendeesAction(eventSlug);
      await saveAttendees(list);
      setLocalCount(list.length);
      await refreshCounts();
      setNotice(`ดาวน์โหลดรายชื่อ ${list.length} คนลงเครื่องแล้ว พร้อมทำงานแม้เน็ตหลุด`);
    } catch {
      setNotice("ดาวน์โหลดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint(format: "lanyard" | "wristband", isReprint: boolean) {
    if (!result || (result.status !== "success" && result.status !== "duplicate")) return;
    const token = lastScannedRef.current?.token;
    if (!token) return;

    setPrinting({ qrToken: token, format });
    if (navigator.onLine) {
      void recordBadgePrintAction({ qrToken: token, format, isReprint });
    }
    window.open(`/staff/badge/${token}?format=${format}&autoprint=1`, "_blank", "noopener");
  }

  const percentText = stats ? `${stats.percent}%` : "-";

  return (
    <div className="min-h-screen flex flex-col">
      <ConnectionBar
        state={state}
        pendingCount={pendingCount}
        lastSync={lastSync}
        staffName={staffName}
        onSync={() => void sync()}
      />

      <main className="flex-1 mx-auto w-full max-w-lg p-4 flex flex-col gap-4">
        {/* ตัวนับผู้เช็คอินแบบสด */}
        <section className="bg-surface border border-line rounded-[var(--radius-card)] p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">เช็คอินแล้ว</p>
            <p className="text-sm text-muted">{percentText}</p>
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {stats?.checkedIn ?? 0}{" "}
            <span className="text-base font-normal text-muted">/ {stats?.total ?? 0} คน</span>
          </p>
          <div
            className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={stats?.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ความคืบหน้าการเช็คอิน"
          >
            <div className="h-full bg-primary" style={{ width: `${stats?.percent ?? 0}%` }} />
          </div>
          {stats && stats.bySession.length > 0 && (
            <p className="text-xs text-muted mt-2">
              {stats.bySession.map((s) => `${s.name} ${s.checkedIn}/${s.total}`).join(" · ")}
            </p>
          )}
        </section>

        {notice && (
          <p className="bg-success-bg text-success rounded-[var(--radius-control)] px-4 py-3 text-sm">
            {notice}
          </p>
        )}

        {printing && (
          <p className="bg-primary-light text-primary-dark rounded-[var(--radius-control)] px-4 py-3 text-sm">
            เปิดหน้าพิมพ์บัตรในแท็บใหม่แล้ว — ถ้าไม่ขึ้น กรุณาอนุญาต pop-up ของเว็บนี้
          </p>
        )}

        {result ? (
          <ScanResult
            result={result}
            offline={!online}
            onPrint={handlePrint}
            onNext={() => {
              setResult(null);
              setPrinting(null);
            }}
            onSearch={() => router.push("/staff/search")}
            onWalkIn={() => router.push("/staff/walkin")}
          />
        ) : (
          <>
            <QrScanner onScan={(text) => void handleScan(text)} paused={result !== null} />
            <p className="text-center text-sm text-ink-2">
              เล็งกล้องไปที่ QR Code บนหน้าจอหรือบนตั๋วกระดาษ
            </p>
          </>
        )}

        {/* ทางเลือกสำรอง */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/staff/search"
            className="min-h-[var(--control-height)] flex items-center justify-center gap-2 rounded-[var(--radius-pill)]
              border border-line-strong bg-surface text-ink-2 font-medium"
          >
            🔍 ค้นหารายชื่อ
          </Link>
          <Link
            href="/staff/walkin"
            className="min-h-[var(--control-height)] flex items-center justify-center gap-2 rounded-[var(--radius-pill)]
              border border-line-strong bg-surface text-ink-2 font-medium"
          >
            ➕ ลงทะเบียนหน้างาน
          </Link>
        </div>

        {/* เตรียมพร้อมสำหรับกรณีเน็ตหลุด */}
        <section className="bg-surface border border-line rounded-[var(--radius-card)] p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">ข้อมูลสำรองในเครื่อง</p>
              <p className="text-xs text-muted">
                {localCount > 0
                  ? `มีรายชื่อ ${localCount} คน พร้อมใช้ตอนเน็ตหลุด`
                  : "ยังไม่ได้ดาวน์โหลด — กดปุ่มนี้ก่อนวันงาน"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || !online}
              className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-primary text-primary-dark
                bg-surface text-sm font-medium disabled:border-line disabled:text-muted"
            >
              {downloading ? "กำลังดาวน์โหลด..." : "ดาวน์โหลดรายชื่อ"}
            </button>
          </div>
          {localCount === 0 && (
            <p className="text-xs text-warning">
              ⚠️ ถ้าไม่ดาวน์โหลดไว้ เมื่อเน็ตหลุดจะสแกนไม่ได้เลย
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
