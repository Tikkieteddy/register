import type { Metadata, Viewport } from "next";
import { SiteCredit } from "@/components/site/SiteCredit";
import { RegisterServiceWorker } from "@/components/staff/RegisterServiceWorker";

export const metadata: Metadata = {
  title: { default: "ระบบลงทะเบียนหน้างาน", template: "%s" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "เช็คอิน", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#EC5F27",
  // ห้ามซูมเข้าออกโดยไม่ตั้งใจระหว่างสแกน แต่ยังขยายด้วยระบบช่วยการเข้าถึงได้
  maximumScale: 5,
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <RegisterServiceWorker />
      <div className="flex-1">{children}</div>
      {/*
        หน้าสแกนใช้บนมือถือหน้างาน พื้นที่จอมีจำกัด
        เครดิตจึงวางไว้ท้ายสุดและใช้ตัวเล็ก ไม่ให้แย่งพื้นที่ปุ่มสแกน
      */}
      <SiteCredit className="py-3 px-4 border-t border-line" />
    </div>
  );
}
