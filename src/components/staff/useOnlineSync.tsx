"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getQueueServerSnapshot,
  getQueueSnapshot,
  refreshQueueState,
  subscribeQueue,
  syncQueue,
} from "@/lib/offline/queue-store";

export type ConnectionState = "online" | "offline" | "syncing";

/**
 * สถานะออนไลน์ อ่านผ่าน useSyncExternalStore
 *
 * เป็นวิธีที่ถูกต้องสำหรับการอ่านค่าจากภายนอก React แทนการ setState ใน effect
 * ฝั่งเซิร์ฟเวอร์คืน true เสมอ (ยังไม่มี navigator) แล้วค่อยแก้เป็นค่าจริงตอน hydrate
 */
function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

/**
 * สถานะการเชื่อมต่อและคิวการเช็คอินที่รอส่ง
 *
 * ตามข้อกำหนด E3 — ต้องแสดงสถานะชัดเจนบนหน้าจอ (ออนไลน์ / ออฟไลน์ / กำลัง sync)
 * และ sync กลับอัตโนมัติเมื่อเน็ตกลับมา โดยเจ้าหน้าที่ไม่ต้องกดอะไร
 */
export function useOnlineSync() {
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const queue = useSyncExternalStore(subscribeQueue, getQueueSnapshot, getQueueServerSnapshot);

  const sync = useCallback(() => syncQueue(), []);
  const refreshCounts = useCallback(() => refreshQueueState(), []);

  // เน็ตกลับมาแล้ว sync ทันทีโดยเจ้าหน้าที่ไม่ต้องกดอะไร
  // (syncQueue เปลี่ยนสถานะใน store ภายนอก ไม่ใช่ setState ของ React)
  useEffect(() => {
    if (online) void syncQueue();
  }, [online]);

  // เผื่อกรณีที่เบราว์เซอร์ไม่ยิง event ให้ — ลอง sync ซ้ำทุก 30 วินาที
  useEffect(() => {
    const id = window.setInterval(() => {
      if (navigator.onLine) void syncQueue();
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const state: ConnectionState = queue.syncing ? "syncing" : online ? "online" : "offline";

  return {
    state,
    online,
    pendingCount: queue.pendingCount,
    lastSync: queue.lastSync,
    sync,
    refreshCounts,
  };
}

/** แถบสถานะการเชื่อมต่อ — อยู่บนสุดของทุกหน้าในระบบเจ้าหน้าที่ */
export function ConnectionBar({
  state,
  pendingCount,
  lastSync,
  staffName,
  onSync,
}: {
  state: ConnectionState;
  pendingCount: number;
  lastSync: string | null;
  staffName: string;
  onSync: () => void;
}) {
  const label =
    state === "syncing"
      ? `กำลังซิงค์... เหลือ ${pendingCount} รายการ`
      : state === "offline"
        ? `ออฟไลน์ · บันทึกในเครื่อง ${pendingCount} รายการ`
        : lastSync
          ? `ออนไลน์ · ข้อมูลล่าสุด ${new Date(lastSync).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
          : "ออนไลน์";

  const dot = state === "syncing" ? "🟡" : state === "offline" ? "🔴" : "🟢";
  const tone =
    state === "offline"
      ? "bg-[var(--color-danger-bg)] text-danger"
      : state === "syncing"
        ? "bg-warning-bg text-warning"
        : "bg-success-bg text-success";

  return (
    <div className={`${tone} px-4 py-2 flex items-center gap-2 text-sm`} aria-live="polite">
      <span aria-hidden="true">{dot}</span>
      <span className="font-medium">{label}</span>
      {state === "offline" && pendingCount > 0 && (
        <span className="text-xs opacity-80">— ห้ามปิดแท็บนี้จนกว่าจะซิงค์เสร็จ</span>
      )}
      <div className="ms-auto flex items-center gap-3">
        {pendingCount > 0 && state !== "syncing" && (
          <button type="button" onClick={onSync} className="underline font-medium">
            ซิงค์เดี๋ยวนี้
          </button>
        )}
        <span className="text-ink-2 hidden sm:inline">{staffName}</span>
      </div>
    </div>
  );
}
