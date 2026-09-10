"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * แถบเมนูของหน้าเว็บฝั่งผู้เข้าร่วมงาน
 *
 * ใช้ร่วมกันทุกหน้าที่คนทั่วไปเห็น เพื่อให้ไม่ว่าเข้ามาหน้าไหนก็ไปหน้าอื่นต่อได้
 * เดิมแต่ละหน้ามีแถบหัวของตัวเอง ลิงก์ไม่เหมือนกัน คนที่เปิดหน้านโยบายจากอีเมล
 * จึงกลับไปหน้างานไม่ได้เลยนอกจากกดปุ่มย้อนกลับ
 *
 * ⚠️ บนมือถือต้องยุบเป็นปุ่มเปิด-ปิด ไม่ใช่ซ่อนลิงก์ทิ้ง
 *    ผู้เข้าร่วมงานเกินครึ่งเปิดจากมือถือ ถ้าเข้าเมนูไม่ได้ก็เท่ากับไม่มีเมนู
 */

/**
 * ลิงก์ที่คนทั่วไปเข้าได้ทั้งหมด — คุมไว้ที่เดียว เพิ่มหน้าใหม่แล้วขึ้นทุกหน้าพร้อมกัน
 *
 * ลิงก์ "รายละเอียดงาน" กับ "ลงทะเบียน" ผูกกับงานใดงานหนึ่ง จึงต้องสร้างตอนใช้งาน
 * ไม่ใช่เขียนตายตัวไว้ที่นี่ ระบบรองรับหลายงานพร้อมกัน
 */
function buildLinks(eventSlug?: string | null) {
  return [
    { href: "/", label: "งานทั้งหมด" },
    ...(eventSlug
      ? [
          { href: `/e/${eventSlug}`, label: "รายละเอียดงาน" },
          { href: `/e/${eventSlug}/register`, label: "ลงทะเบียน" },
        ]
      : []),
    { href: "/privacy", label: "ความเป็นส่วนตัว" },
    { href: "/terms", label: "เงื่อนไขการใช้งาน" },
  ];
}

export function SiteHeader({
  siteName = "ระบบรับลงทะเบียนเข้าร่วมงาน",
  eventSlug,
}: {
  siteName?: string;
  /** งานที่จะให้ลิงก์ "รายละเอียดงาน" และ "ลงทะเบียน" ชี้ไป — ไม่ส่งมาก็ซ่อนสองลิงก์นั้น */
  eventSlug?: string | null;
}) {
  const pathname = usePathname() ?? "/";
  const links = buildLinks(eventSlug);
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);

  /**
   * ปิดเมนูทุกครั้งที่เปลี่ยนหน้า ไม่งั้นเมนูจะค้างคาหน้าจอหลังกดลิงก์บนมือถือ
   *
   * ปรับ state ระหว่าง render แทนการใช้ useEffect ตามที่ React แนะนำ
   * เพราะถ้าใช้ effect เมนูจะค้างให้เห็นแวบหนึ่งก่อนหายไป (วาดสองรอบ)
   */
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  /**
   * หน้ารายละเอียดงานกับหน้าฟอร์มมี path ซ้อนกัน (/e/x กับ /e/x/register)
   * ถ้าใช้ startsWith อย่างเดียว ตอนอยู่หน้าฟอร์มจะไฮไลต์ทั้งสองปุ่มพร้อมกัน
   * จึงเทียบแบบตรงตัวสำหรับลิงก์ที่ชี้ไปหน้างานโดยเฉพาะ
   */
  const isActive = (href: string) => {
    if (href === "/" || href.startsWith("/e/")) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[color:var(--color-surface)]/85 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="h-16 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-[family-name:var(--font-display)] font-bold
              text-ink hover:text-primary-dark transition-colors min-w-0"
          >
            <span
              aria-hidden="true"
              className="grid place-items-center size-9 shrink-0 rounded-[10px]
                bg-gradient-to-br from-primary to-primary-dark text-white text-lg"
            >
              ✦
            </span>
            <span className="truncate text-[15px] sm:text-base tracking-tight">{siteName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ms-auto" aria-label="เมนูหลัก">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`px-3 py-2 rounded-[var(--radius-pill)] text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-primary-light text-primary-dark font-semibold"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <span aria-hidden="true" className="mx-2 h-5 w-px bg-[color:var(--color-line)]" />

            <Link
              href="/admin"
              className="px-4 py-2 rounded-[var(--radius-pill)] text-sm border border-line-strong
                text-ink-2 hover:border-primary hover:text-primary-dark transition-colors"
            >
              เข้าสู่ระบบ
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="md:hidden ms-auto min-h-11 min-w-11 grid place-items-center
              rounded-[var(--radius-control)] border border-line-strong text-ink-2"
          >
            <span className="sr-only">{open ? "ปิดเมนู" : "เปิดเมนู"}</span>
            <span aria-hidden="true" className="text-lg leading-none">
              {open ? "✕" : "☰"}
            </span>
          </button>
        </div>

        {/* ใช้ hidden ผ่าน state แทนการถอดออกจาก DOM เพื่อให้เครื่องอ่านหน้าจอเห็นโครงเมนูเสมอ */}
        <nav
          id="site-menu"
          hidden={!open}
          aria-label="เมนูหลัก (มือถือ)"
          className="md:hidden pb-3 flex flex-col gap-1"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`min-h-11 flex items-center px-3 rounded-[var(--radius-control)] text-sm ${
                isActive(link.href)
                  ? "bg-primary-light text-primary-dark font-semibold"
                  : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin"
            className="min-h-11 flex items-center px-3 rounded-[var(--radius-control)] text-sm
              border border-line-strong text-ink-2 mt-1"
          >
            เข้าสู่ระบบสำหรับเจ้าหน้าที่และผู้ดูแล
          </Link>
        </nav>
      </div>
    </header>
  );
}
