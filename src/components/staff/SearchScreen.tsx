"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  checkInByTokenAction,
  searchRegistrantsAction,
  type CheckInResult,
  type SearchHit,
} from "@/app/actions/checkin";
import { inputClass } from "@/components/form/Field";
import { ScanResult } from "./ScanResult";
import { ConnectionBar, useOnlineSync } from "./useOnlineSync";
import { getDeviceId, markCheckedInLocally, searchAttendees } from "@/lib/offline/db";
import { playFeedback, primeAudio } from "@/lib/offline/feedback";
import { enqueueCheckIn } from "@/lib/offline/queue-store";

/**
 * ค้นหาผู้ลงทะเบียนด้วยชื่อ / เบอร์โทร / อีเมล / รหัส
 * ใช้เมื่อสแกน QR ไม่ติด ตามข้อกำหนด B1
 *
 * ทำงานได้ทั้งออนไลน์ (ค้นที่เซิร์ฟเวอร์) และออฟไลน์ (ค้นใน IndexedDB)
 */
export function SearchScreen({ eventSlug, staffName }: { eventSlug: string; staffName: string }) {
  const router = useRouter();
  const { state, online, pendingCount, lastSync, sync, refreshCounts } = useOnlineSync();
  const [keyword, setKeyword] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      try {
        if (navigator.onLine) {
          setHits(await searchRegistrantsAction(eventSlug, q));
        } else {
          const local = await searchAttendees(q);
          setHits(
            local.map((a) => ({
              qrToken: a.qrToken,
              firstName: a.firstName,
              lastName: a.lastName,
              registrationCode: a.registrationCode,
              phoneMasked: a.phoneMasked,
              sessionNames: a.sessionNames,
              checkedIn: a.checkedIn,
              checkedInAt: null,
            })),
          );
        }
      } finally {
        setSearching(false);
      }
    },
    [eventSlug],
  );

  // หน่วงการค้นหาไว้ 300 ms เพื่อไม่ให้ยิงทุกตัวอักษรที่พิมพ์
  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(keyword), 300);
    return () => window.clearTimeout(id);
  }, [keyword, runSearch]);

  async function confirmCheckIn(hit: SearchHit) {
    primeAudio();
    if (navigator.onLine) {
      const outcome = await checkInByTokenAction({
        qrToken: hit.qrToken,
        deviceId: getDeviceId(),
        method: "search",
      });
      setResult(outcome);
      playFeedback(
        outcome.status === "success"
          ? "success"
          : outcome.status === "duplicate"
            ? "duplicate"
            : "invalid",
      );
      if (outcome.status === "success") await markCheckedInLocally(hit.qrToken);
      return;
    }

    const checkedInAt = new Date().toISOString();
    await enqueueCheckIn({
      qrToken: hit.qrToken,
      checkedInAt,
      deviceId: getDeviceId(),
      method: "search",
    });
    await markCheckedInLocally(hit.qrToken);
    await refreshCounts();
    setResult({
      status: "success",
      person: {
        registrationId: "",
        ticketId: "",
        firstName: hit.firstName,
        lastName: hit.lastName,
        occupation: null,
        registrationCode: hit.registrationCode,
        sessionNames: hit.sessionNames,
      },
      checkedInAt,
    });
    playFeedback("success");
  }

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
        <div className="flex items-center gap-3">
          <Link href="/staff" className="text-primary-dark font-medium">
            ← กลับ
          </Link>
          <h1 className="text-lg font-semibold text-ink">ค้นหารายชื่อ</h1>
        </div>

        {result ? (
          <ScanResult
            result={result}
            offline={!online}
            onPrint={(format) => {
              const hit = hits.find(
                (h) =>
                  result.status !== "invalid" &&
                  result.status !== "forbidden" &&
                  h.registrationCode === result.person.registrationCode,
              );
              if (hit) {
                window.open(
                  `/staff/badge/${hit.qrToken}?format=${format}&autoprint=1`,
                  "_blank",
                  "noopener",
                );
              }
            }}
            onNext={() => {
              setResult(null);
              setKeyword("");
              setHits([]);
            }}
            onSearch={() => setResult(null)}
            onWalkIn={() => router.push("/staff/walkin")}
          />
        ) : (
          <>
            <input
              type="search"
              inputMode="search"
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ชื่อ / นามสกุล / เบอร์โทร / อีเมล / รหัสลงทะเบียน"
              aria-label="ค้นหาผู้ลงทะเบียน"
              className={inputClass(false)}
            />

            {searching && <p className="text-sm text-muted">กำลังค้นหา...</p>}

            {!searching && keyword.trim().length >= 2 && hits.length === 0 && (
              <div className="text-center py-8 flex flex-col items-center gap-3">
                <p className="text-ink-2">ไม่พบผู้ลงทะเบียนที่ตรงกับคำค้น</p>
                <Link
                  href="/staff/walkin"
                  className="min-h-11 px-5 inline-flex items-center rounded-[var(--radius-pill)]
                    bg-primary text-primary-contrast font-semibold"
                >
                  ➕ ลงทะเบียนหน้างาน
                </Link>
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {hits.map((hit) => (
                <li key={hit.qrToken}>
                  <button
                    type="button"
                    onClick={() => void confirmCheckIn(hit)}
                    className="w-full text-start bg-surface border border-line rounded-[var(--radius-control)]
                      p-3 flex items-center gap-3 hover:border-primary transition-colors"
                  >
                    <span
                      className={`size-2.5 rounded-full shrink-0 ${hit.checkedIn ? "bg-line-strong" : "bg-success"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink truncate">
                        {hit.firstName} {hit.lastName}
                      </span>
                      <span className="block text-sm text-muted">
                        {hit.phoneMasked} · {hit.sessionNames.join(" · ") || "-"}
                      </span>
                    </span>
                    <span className="text-end shrink-0">
                      <span className="block font-mono text-sm text-ink">
                        {hit.registrationCode}
                      </span>
                      <span
                        className={`block text-xs ${hit.checkedIn ? "text-muted" : "text-success"}`}
                      >
                        {hit.checkedIn ? "เช็คอินแล้ว" : "ยังไม่เช็คอิน"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
