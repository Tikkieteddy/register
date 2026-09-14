"use client";

import { useState } from "react";
import { Tour, type TourStep } from "./Tour";

/**
 * ปุ่มเปิดคำแนะนำซ้ำ + ตัวคำแนะนำในชิ้นเดียว
 *
 * ⚠️ ต้องมีปุ่มเปิดซ้ำเสมอ ห้ามมีแต่การเปิดอัตโนมัติครั้งแรก
 *    คนส่วนใหญ่กด "ข้าม" ตอนแรกเพราะรีบ แล้วพอถึงเวลาใช้จริงจะหาไม่เจอว่าปุ่มไหนทำอะไร
 *    โดยเฉพาะเจ้าหน้าที่หน้างานที่เข้ามาใช้ปีละครั้ง
 */
export function TourLauncher({
  steps,
  storageKey,
  label = "ดูคำแนะนำการใช้งาน",
  className = "",
}: {
  steps: TourStep[];
  storageKey: string;
  label?: string;
  className?: string;
}) {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <>
      {/*
       * ⚠️ ต้องให้เปิดอัตโนมัติได้เสมอ (autoStart ค้างเป็นจริง) และสั่งให้เริ่มใหม่
       *    ด้วยการเปลี่ยน key เท่านั้น
       *
       *    เคยเขียนเป็น autoStart={!forced} แล้วปิดการเปิดอัตโนมัติตอนกดปุ่มดูซ้ำ
       *    ผลคือกดปุ่มแล้วไม่มีอะไรขึ้นเลย เพราะปิดทางเปิดทางเดียวที่มีอยู่ทิ้งไป
       */}
      <Tour key={replayKey} steps={steps} storageKey={storageKey} />

      <button
        type="button"
        onClick={() => {
          try {
            // ลบร่องรอยว่าเคยดู เพื่อให้รอบใหม่เปิดเองได้อีกครั้ง
            localStorage.removeItem(storageKey);
          } catch {
            // เบราว์เซอร์ปิดการเก็บข้อมูล — ยังเปิดดูได้ แค่จำไม่ได้ว่าเคยดู
          }
          setReplayKey((k) => k + 1);
        }}
        className={`text-xs text-muted hover:text-primary-dark underline min-h-11 ${className}`}
      >
        {label}
      </button>
    </>
  );
}
