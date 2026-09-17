import { redirect } from "next/navigation";

/**
 * ที่อยู่เดิมของหน้า "จัดการงาน" — ย้ายไปเป็นหน้าแรกของหลังบ้านแล้ว
 *
 * เก็บไว้เป็นทางผ่าน เพราะผู้ดูแลหลายคนบุ๊กมาร์กที่อยู่นี้ไว้
 * และลิงก์เก่าในอีเมลหรือเอกสารภายในยังชี้มาที่นี่
 */
export default function AdminEventsRedirect() {
  redirect("/admin-cms");
}
