"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectEventAction } from "@/app/actions/admin/event";

/**
 * ปุ่มเข้าไปจัดการงานหนึ่งงานจากหน้ารายการงาน
 *
 * รวมสองขั้นตอนเดิมให้เหลือคลิกเดียว — เดิมต้องกด "สลับมางานนี้" ก่อน
 * แล้วค่อยกดเมนู Dashboard อีกที ซึ่งคนใช้งานมักลืมขั้นแรกแล้วไปแก้ข้อมูลผิดงาน
 *
 * ⚠️ ต้องเรียก server action ให้เสร็จก่อนค่อยเปลี่ยนหน้า ไม่ใช่เปลี่ยนหน้าไปเลย
 *    เพราะงานที่เลือกถูกจำไว้ในคุกกี้ ถ้าเปลี่ยนหน้าก่อนคุกกี้ถูกตั้ง
 *    หน้า Dashboard จะโหลดข้อมูลของงานเดิมขึ้นมาแทน
 */
export function EnterEventButton({
  slug,
  isCurrent,
}: {
  slug: string;
  /** งานที่กำลังจัดการอยู่ตอนนี้ — ใช้เปลี่ยนข้อความบนปุ่มให้ตรงกับสิ่งที่จะเกิดขึ้น */
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await selectEventAction(slug);
          router.push("/admin-cms/dashboard");
        })
      }
      className="inline-flex items-center min-h-11 px-4 rounded-[var(--radius-pill)]
        bg-primary text-white hover:bg-primary-dark transition-colors
        text-sm font-semibold disabled:opacity-60"
    >
      {pending ? "กำลังเปิด…" : isCurrent ? "เข้าจัดการต่อ" : "เข้าจัดการงานนี้"}
    </button>
  );
}
