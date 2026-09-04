"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * ฐานข้อมูลในเครื่องเจ้าหน้าที่ สำหรับทำงานตอนเน็ตหลุด (ข้อกำหนด E3)
 *
 * เก็บ 2 อย่าง:
 *   ① รายชื่อผู้ลงทะเบียนที่ดาวน์โหลดไว้ล่วงหน้า — ใช้ตรวจ QR ตอนออฟไลน์
 *   ② คิวการเช็คอินที่ยังส่งขึ้นเซิร์ฟเวอร์ไม่ได้ — sync อัตโนมัติเมื่อเน็ตกลับมา
 *
 * ⚠️ ข้อมูลนี้อยู่บนเครื่องเจ้าหน้าที่ จึงเก็บเท่าที่จำเป็นต่อการเช็คอินเท่านั้น
 *    ไม่เก็บอีเมลเต็มหรือข้อมูลที่ไม่ได้ใช้หน้างาน
 */

export type OfflineAttendee = {
  qrToken: string;
  firstName: string;
  lastName: string;
  occupation: string | null;
  registrationCode: string;
  phoneMasked: string;
  sessionNames: string[];
  /** เช็คอินไปแล้วตามข้อมูลตอนดาวน์โหลด */
  checkedIn: boolean;
};

export type PendingCheckIn = {
  /** ใช้ qrToken เป็น key ทำให้สแกนซ้ำบนเครื่องเดิมไม่สร้างคิวซ้ำ */
  qrToken: string;
  checkedInAt: string;
  deviceId: string;
  method: "qr" | "search";
};

interface StaffDb extends DBSchema {
  attendees: { key: string; value: OfflineAttendee };
  pending: { key: string; value: PendingCheckIn };
  meta: { key: string; value: { key: string; value: string } };
}

const DB_NAME = "staff-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StaffDb>> | null = null;

function getDb(): Promise<IDBPDatabase<StaffDb>> {
  dbPromise ??= openDB<StaffDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("attendees", { keyPath: "qrToken" });
      db.createObjectStore("pending", { keyPath: "qrToken" });
      db.createObjectStore("meta", { keyPath: "key" });
    },
  });
  return dbPromise;
}

/** บันทึกรายชื่อทั้งหมดลงเครื่อง — เรียกตอนกด "ดาวน์โหลดรายชื่อ" ก่อนวันงาน */
export async function saveAttendees(list: OfflineAttendee[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["attendees", "meta"], "readwrite");
  await tx.objectStore("attendees").clear();
  for (const a of list) await tx.objectStore("attendees").put(a);
  await tx.objectStore("meta").put({ key: "lastSync", value: new Date().toISOString() });
  await tx.done;
}

export async function getAttendee(qrToken: string): Promise<OfflineAttendee | undefined> {
  const db = await getDb();
  return db.get("attendees", qrToken);
}

export async function countAttendees(): Promise<number> {
  const db = await getDb();
  return db.count("attendees");
}

export async function searchAttendees(keyword: string): Promise<OfflineAttendee[]> {
  const q = keyword.trim().toLowerCase();
  if (q.length < 2) return [];
  const db = await getDb();
  const all = await db.getAll("attendees");
  return all
    .filter((a) =>
      [a.firstName, a.lastName, a.registrationCode, a.phoneMasked]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 20);
}

/** ทำเครื่องหมายว่าเช็คอินแล้วในข้อมูลบนเครื่อง เพื่อให้สแกนซ้ำขึ้นจอเหลืองได้แม้ออฟไลน์ */
export async function markCheckedInLocally(qrToken: string): Promise<void> {
  const db = await getDb();
  const found = await db.get("attendees", qrToken);
  if (found) await db.put("attendees", { ...found, checkedIn: true });
}

export async function queueCheckIn(item: PendingCheckIn): Promise<void> {
  const db = await getDb();
  await db.put("pending", item);
}

export async function getPendingCheckIns(): Promise<PendingCheckIn[]> {
  const db = await getDb();
  return db.getAll("pending");
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.count("pending");
}

export async function removePending(qrToken: string): Promise<void> {
  const db = await getDb();
  await db.delete("pending", qrToken);
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await getDb();
  const row = await db.get("meta", "lastSync");
  return row?.value ?? null;
}

/** รหัสเครื่อง ใช้แกะรอยตอน sync ชนกันระหว่างเครื่องหลายเครื่อง */
export function getDeviceId(): string {
  const KEY = "staff-device-id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = `dev-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "dev-unknown";
  }
}
