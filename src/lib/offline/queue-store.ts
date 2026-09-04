"use client";

import { syncPendingCheckInsAction } from "@/app/actions/staff-sync";
import {
  countPending,
  getLastSyncTime,
  getPendingCheckIns,
  queueCheckIn as writeQueueCheckIn,
  removePending,
  type PendingCheckIn,
} from "./db";

/**
 * สถานะคิวการเช็คอินที่รอส่งขึ้นเซิร์ฟเวอร์
 *
 * เก็บไว้นอก React แล้วให้คอมโพเนนต์อ่านผ่าน useSyncExternalStore
 * ข้อดี 2 อย่าง:
 *   ① ไม่ต้อง setState ใน effect ซึ่งทำให้เกิด render ซ้อน
 *   ② สถานะ sync เป็นของกลาง สลับไปมาระหว่างหน้าสแกนกับหน้าค้นหาแล้วไม่รีเซ็ต
 */

type QueueState = {
  pendingCount: number;
  lastSync: string | null;
  syncing: boolean;
};

let state: QueueState = { pendingCount: 0, lastSync: null, syncing: false };
let initialized = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<QueueState>): void {
  // สร้าง object ใหม่เสมอ เพื่อให้ useSyncExternalStore รู้ว่าค่าเปลี่ยน
  state = { ...state, ...patch };
  emit();
}

/** อ่านค่าล่าสุดจาก IndexedDB เข้ามาเก็บใน store */
export async function refreshQueueState(): Promise<void> {
  const [pendingCount, lastSync] = await Promise.all([countPending(), getLastSyncTime()]);
  setState({ pendingCount, lastSync });
}

export function subscribeQueue(callback: () => void): () => void {
  listeners.add(callback);
  // อ่านค่าครั้งแรกตอนมีคนสมัครรับ — ทำครั้งเดียวตลอดอายุหน้าเว็บ
  if (!initialized) {
    initialized = true;
    void refreshQueueState();
  }
  return () => listeners.delete(callback);
}

export function getQueueSnapshot(): QueueState {
  return state;
}

/** ฝั่งเซิร์ฟเวอร์ยังไม่มี IndexedDB — คืนค่าเริ่มต้นคงที่ */
const SERVER_STATE: QueueState = { pendingCount: 0, lastSync: null, syncing: false };
export function getQueueServerSnapshot(): QueueState {
  return SERVER_STATE;
}

/** เพิ่มการเช็คอินเข้าคิว แล้วอัปเดตตัวนับให้หน้าจอเห็นทันที */
export async function enqueueCheckIn(item: PendingCheckIn): Promise<void> {
  await writeQueueCheckIn(item);
  await refreshQueueState();
}

/**
 * ส่งการเช็คอินที่ค้างอยู่ขึ้นเซิร์ฟเวอร์
 *
 * เรียกซ้ำได้อย่างปลอดภัย — ถ้ากำลัง sync อยู่จะไม่ทำอะไร
 */
export async function syncQueue(): Promise<void> {
  if (state.syncing) return;

  const items = await getPendingCheckIns();
  if (items.length === 0) {
    await refreshQueueState();
    return;
  }

  setState({ syncing: true });
  try {
    const outcomes = await syncPendingCheckInsAction(items);
    for (const outcome of outcomes) {
      // สำเร็จหรือซ้ำ ถือว่าจัดการเสร็จแล้วทั้งคู่ — เอาออกจากคิวได้
      // (ซ้ำแปลว่าอีกเครื่องสแกนคนเดียวกันไปก่อนแล้ว ซึ่งถูกต้องตามกฎเวลาที่เร็วที่สุดชนะ)
      if (outcome.status === "success" || outcome.status === "duplicate") {
        await removePending(outcome.qrToken);
      }
    }
  } catch {
    // sync ไม่สำเร็จก็ปล่อยไว้ในคิว รอบหน้าจะลองใหม่
  } finally {
    setState({ syncing: false });
    await refreshQueueState();
  }
}
