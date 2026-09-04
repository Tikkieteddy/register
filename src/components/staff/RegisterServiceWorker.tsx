"use client";

import { useEffect } from "react";

/**
 * ลงทะเบียน Service Worker ให้หน้าเจ้าหน้าที่เปิดได้แม้เน็ตหลุด
 *
 * เบราว์เซอร์อนุญาตให้ใช้ Service Worker เฉพาะ HTTPS (ยกเว้น localhost)
 * เหมือนกับกล้อง — ถ้าเข้าผ่าน http จะไม่ทำงานทั้งคู่
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/staff" }).catch(() => {
      // ลงทะเบียนไม่สำเร็จก็ยังใช้งานออนไลน์ได้ตามปกติ
    });
  }, []);

  return null;
}
