"use client";

/**
 * ปุ่มสั่งพิมพ์รายงาน
 *
 * ใช้การพิมพ์ของเบราว์เซอร์แทนการสร้าง PDF ฝั่งเซิร์ฟเวอร์
 * เพราะไลบรารี PDF ฝั่งเซิร์ฟเวอร์วางสระและวรรณยุกต์ไทยผิดตำแหน่ง
 * ส่วนเบราว์เซอร์จัดวางภาษาไทยได้ถูกต้องอยู่แล้ว
 */
export function PrintButton({ label = "บันทึกเป็น PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark print:hidden"
    >
      {label}
    </button>
  );
}
