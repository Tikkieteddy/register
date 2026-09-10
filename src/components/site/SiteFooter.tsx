import Link from "next/link";
import { currentYear } from "@/lib/datetime";

/**
 * ท้ายหน้าของฝั่งผู้เข้าร่วมงาน
 *
 * ต้องมีลิงก์นโยบายความเป็นส่วนตัวทุกหน้าที่เก็บข้อมูลส่วนบุคคล
 * เป็นข้อกำหนดของ PDPA ไม่ใช่แค่ความสวยงาม
 */
export function SiteFooter({ siteName = "ระบบรับลงทะเบียนเข้าร่วมงาน" }: { siteName?: string }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <p className="text-sm text-muted">
          © {currentYear()} {siteName}
        </p>
        <nav aria-label="ลิงก์ท้ายหน้า" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="text-ink-2 hover:text-primary-dark transition-colors">
            งานทั้งหมด
          </Link>
          <Link href="/privacy" className="text-ink-2 hover:text-primary-dark transition-colors">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link href="/terms" className="text-ink-2 hover:text-primary-dark transition-colors">
            เงื่อนไขการใช้งาน
          </Link>
          <Link href="/admin" className="text-muted hover:text-primary-dark transition-colors">
            เข้าสู่ระบบ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
