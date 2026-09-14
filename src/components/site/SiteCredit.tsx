import { currentYear } from "@/lib/datetime";

/**
 * เครดิตท้ายหน้า — ต้องขึ้นทุกหน้าของระบบ
 *
 * แยกเป็นชิ้นเดียวใช้ซ้ำ เพราะข้อความนี้ต้องเหมือนกันเป๊ะทุกที่
 * ถ้าคัดลอกไปวางทีละหน้า วันหนึ่งจะมีหน้าที่หลุดไม่ได้แก้ตาม
 *
 * ใช้ปี ค.ศ. แบบคำนวณอัตโนมัติ ไม่เขียนตัวเลขตายตัว
 * ปีหน้าจะเปลี่ยนเองโดยไม่ต้องมีใครมานั่งไล่แก้ทุกหน้า
 */
export function SiteCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted text-center leading-relaxed ${className}`}>
      TNN Event Platform
      <span aria-hidden="true" className="mx-1.5">
        ·
      </span>
      © {currentYear("en")} Thai News Network
      <span aria-hidden="true" className="mx-1.5">
        ·
      </span>
      Powered by Digital Media &amp; AI Team | TTD Lab
    </p>
  );
}
