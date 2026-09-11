"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import { EventSwitcher } from "@/components/admin/events/EventSwitcher";
import type { AdminEventOption } from "@/lib/admin/current-event";

/**
 * โครงหน้าของหลังบ้านทั้งหมด — แถบเมนูข้างซ้าย
 *
 * บนมือถือแถบข้างยุบเป็นปุ่มเปิด-ปิด เพราะผู้จัดงานมักเปิดดูยอดลงทะเบียน
 * จากมือถือระหว่างเดินทาง ถ้าปล่อยเมนูกางไว้จะกินพื้นที่จนอ่านตัวเลขไม่สะดวก
 */
const NAV = [
  { href: "/admin-cms", label: "Dashboard", icon: "▦" },
  { href: "/admin-cms/registrations", label: "ผู้ลงทะเบียน", icon: "☰" },
  { href: "/admin-cms/emails", label: "จัดการอีเมล", icon: "✉" },
  { href: "/admin-cms/links", label: "ลิงก์ติดตามผล", icon: "⇗" },
  { href: "/admin-cms/media", label: "ภาพและสื่อ", icon: "▣" },
  { href: "/admin-cms/settings", label: "ตั้งค่างาน", icon: "⚙" },
  { href: "/admin-cms/events", label: "จัดการงาน", icon: "◈" },
  { href: "/admin-cms/audit", label: "บันทึกการใช้งาน", icon: "⏱" },
] as const;

export function AdminShell({
  children,
  userName,
  eventName,
  events,
  currentSlug,
}: {
  children: ReactNode;
  userName: string;
  eventName: string;
  events: AdminEventOption[];
  currentSlug: string | null;
}) {
  const pathname = usePathname() ?? "/admin";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-bg">
      <header className="lg:hidden bg-surface border-b border-line px-4 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <p className="text-xs text-muted">หลังบ้านผู้ดูแล</p>
          <p className="font-semibold text-ink text-sm truncate">{eventName}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className="min-h-11 px-3 rounded-[var(--radius-control)] border border-line text-sm text-ink-2"
        >
          {menuOpen ? "ปิดเมนู" : "เมนู"}
        </button>
      </header>

      {/* print:hidden — ซ่อนแถบเมนูตอนสั่งพิมพ์ เพื่อให้รายงานเต็มหน้ากระดาษ A4 */}
      <aside
        className={`lg:w-60 lg:shrink-0 bg-surface lg:border-r border-line flex-col print:hidden ${
          menuOpen ? "flex border-b" : "hidden lg:flex"
        }`}
      >
        <div className="px-4 py-4 border-b border-line hidden lg:flex lg:flex-col lg:gap-3">
          <div>
            <p className="text-xs text-muted">หลังบ้านผู้ดูแล</p>
            <p className="font-semibold text-ink leading-snug">{eventName}</p>
          </div>
          <EventSwitcher events={events} currentSlug={currentSlug} />
        </div>

        <div className="p-3 border-b border-line lg:hidden">
          <EventSwitcher events={events} currentSlug={currentSlug} />
        </div>

        <nav className="flex flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active =
              item.href === "/admin-cms" ? pathname === "/admin-cms" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-primary-light text-primary-dark font-semibold"
                    : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none w-4 text-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 border-t border-line">
          <p className="text-xs text-muted">เข้าสู่ระบบเป็น</p>
          <p className="text-sm text-ink font-medium truncate">{userName}</p>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-xs text-primary-dark hover:underline">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-6 py-5">{children}</main>
    </div>
  );
}
