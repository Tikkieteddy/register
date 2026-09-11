import type { Metadata, Viewport } from "next";
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
    <>
      <RegisterServiceWorker />
      {children}
    </>
  );
}
