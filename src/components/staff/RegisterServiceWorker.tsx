"use client";

import { useEffect } from "react";

/**
 * ลงทะเบียน Service Worker ให้หน้าสแกนเปิดได้แม้เน็ตหลุด
 *
 * เบราว์เซอร์อนุญาตให้ใช้ Service Worker เฉพาะ HTTPS (ยกเว้น localhost)
 * เหมือนกับกล้อง — ถ้าเข้าผ่าน http จะไม่ทำงานทั้งคู่
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/admin-scan" });
        const registration = await navigator.serviceWorker.ready;

        /**
         * สั่งเก็บหน้าสแกนไว้ล่วงหน้า เพื่อให้เปิดได้ตอนเน็ตหลุด
         *
         * ⚠️ จุดนี้เคยพลาดมาแล้ว และเป็นบั๊กที่จะเจอตอนเน็ตหลุดหน้างานเท่านั้น
         *
         *    เดิม Service Worker พยายามเก็บหน้าพวกนี้ตั้งแต่ตอนติดตั้ง ซึ่งเป็นจังหวะ
         *    ที่ผู้ใช้ยังอยู่หน้าล็อกอิน เซิร์ฟเวอร์จึงส่งต่อไปหน้าล็อกอินและเก็บไม่สำเร็จ
         *    เงียบ ๆ ทุกหน้า พอเน็ตหลุดจริง เจ้าหน้าที่กดเมนู "ค้นหารายชื่อ"
         *    แล้วได้หน้าเปล่า ใช้อะไรไม่ได้เลย
         *
         *    ตอนนี้คอมโพเนนต์นี้อยู่ในโครงของ /admin-scan เท่านั้น ซึ่งมีด่านตรวจสิทธิ์
         *    อยู่แล้ว การที่มันทำงานได้จึงแปลว่าล็อกอินผ่านแล้วแน่นอน
         *    (หน้าล็อกอินย้ายไปอยู่ที่ /admin ซึ่งเป็นคนละโครงกัน)
         */
        registration.active?.postMessage("warm-up");
      } catch {
        // ลงทะเบียนไม่สำเร็จก็ยังใช้งานออนไลน์ได้ตามปกติ
      }
    })();
  }, []);

  return null;
}
