import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

/**
 * โครงหน้าเอกสารทางกฎหมาย (นโยบายความเป็นส่วนตัว · เงื่อนไขการใช้งาน)
 *
 * แยกออกมาเพราะทั้งสองหน้าต้องหน้าตาเหมือนกันเป๊ะ และต้องอ่านง่ายบนมือถือ
 * ผู้ลงทะเบียนส่วนใหญ่กดเข้ามาจากลิงก์ในฟอร์มระหว่างกรอกข้อมูลบนมือถือ
 */
export function LegalPage({
  title,
  updatedAt,
  version,
  children,
}: {
  title: string;
  updatedAt: string;
  version?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink text-balance">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          ปรับปรุงล่าสุด {updatedAt}
          {version && (
            <>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              เวอร์ชัน {version}
            </>
          )}
        </p>

        {/**
         * ใช้ prose แบบเขียนเองแทน @tailwindcss/typography
         * เพื่อไม่ต้องเพิ่ม dependency สำหรับหน้าเดียวสองหน้า
         * และคุมความกว้างบรรทัดไว้ที่ ~68 ตัวอักษรตามหลักการอ่าน
         */}
        <div
          className="mt-8 flex flex-col gap-6 text-ink-2 leading-relaxed max-w-[68ch]
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-4
            [&_h3]:font-semibold [&_h3]:text-ink
            [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
            [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1.5
            [&_a]:text-primary-dark [&_a]:underline
            [&_table]:w-full [&_table]:text-sm
            [&_th]:text-start [&_th]:font-semibold [&_th]:text-ink [&_th]:py-2 [&_th]:pe-4
            [&_td]:py-2 [&_td]:pe-4 [&_td]:align-top [&_td]:border-t [&_td]:border-line"
        >
          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** กล่องเตือนสำหรับข้อความที่ผู้จัดงานต้องกรอกเองก่อนใช้จริง */
export function NeedsReview({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-bg)] p-4 text-sm">
      <p className="font-semibold text-[color:var(--color-danger)] mb-1">
        ⚠️ ต้องแก้ก่อนเปิดใช้งานจริง
      </p>
      <div className="text-ink-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
