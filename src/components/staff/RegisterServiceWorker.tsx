"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * ลงทะเบียน Service Worker ให้หน้าเจ้าหน้าที่เปิดได้แม้เน็ตหลุด
 *
 * เบราว์เซอร์อนุญาตให้ใช้ Service Worker เฉพาะ HTTPS (ยกเว้น localhost)
 * เหมือนกับกล้อง — ถ้าเข้าผ่าน http จะไม่ทำงานทั้งคู่
 */
export function RegisterServiceWorker() {
  const pathname = usePathname();

  /**
   * ผ่านหน้าล็อกอินมาแล้วหรือยัง
   *
   * ทุกหน้าใต้ /staff ที่ไม่ใช่หน้าล็อกอิน มีด่านตรวจสิทธิ์อยู่แล้ว
   * การที่เรามาอยู่ตรงนี้ได้จึงแปลว่าล็อกอินผ่านแล้วแน่นอน
   * ใช้วิธีนี้แทนการถามฐานข้อมูลซ้ำ เพราะได้คำตอบเดียวกันโดยไม่เพิ่มภาระ
   */
  const isSignedInArea = !pathname.startsWith("/staff/login");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/staff" });
        const registration = await navigator.serviceWorker.ready;

        /**
         * สั่งเก็บหน้าเจ้าหน้าที่ไว้ล่วงหน้า — ต้องทำหลังล็อกอินแล้วเท่านั้น
         *
         * ⚠️ จุดนี้เคยพลาดมาแล้ว และเป็นบั๊กที่จะเจอตอนเน็ตหลุดหน้างานเท่านั้น
         *
         *    เดิม Service Worker พยายามเก็บหน้าพวกนี้ตั้งแต่ตอนติดตั้ง ซึ่งเป็นจังหวะ
         *    ที่ผู้ใช้ยังอยู่หน้าล็อกอิน เซิร์ฟเวอร์จึงส่งต่อไปหน้าล็อกอินและเก็บไม่สำเร็จ
         *    เงียบ ๆ ทุกหน้า พอเน็ตหลุดจริง เจ้าหน้าที่กดเมนู "ค้นหารายชื่อ"
         *    แล้วได้หน้าเปล่า ใช้อะไรไม่ได้เลย
         *
         *    และต้องผูกกับ isSignedInArea ไม่ใช่สั่งครั้งเดียวตอนคอมโพเนนต์เกิด
         *    เพราะโครงหน้านี้ครอบหน้าล็อกอินไว้ด้วย พอล็อกอินเสร็จแล้วเปลี่ยนหน้า
         *    React ไม่ได้สร้างคอมโพเนนต์นี้ใหม่ ถ้าสั่งครั้งเดียวจะสั่งตอนยังไม่ล็อกอิน
         *    แล้วไม่มีโอกาสสั่งอีกเลย
         */
        if (isSignedInArea) registration.active?.postMessage("warm-up");
      } catch {
        // ลงทะเบียนไม่สำเร็จก็ยังใช้งานออนไลน์ได้ตามปกติ
      }
    })();
  }, [isSignedInArea]);

  return null;
}
