import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Sarabun } from "next/font/google";
import "./globals.css";

/**
 * ฟอนต์ต้องรองรับภาษาไทยและอ่านง่ายตามข้อกำหนดด้านการออกแบบ
 * โหลดผ่าน next/font เพื่อให้ self-host อัตโนมัติ ไม่ต้องเรียกไปที่ Google
 * ซึ่งช่วยทั้งเรื่องความเร็ว (LCP) และความเป็นส่วนตัวของผู้ใช้
 */
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบรับลงทะเบียนเข้าร่วมงาน",
  description: "ระบบรับลงทะเบียนเข้าร่วมงาน พร้อม QR Code เช็คอินหน้างาน และรายงานสรุปผล",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EC5F27",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${sarabun.variable}`}>
      <body>{children}</body>
    </html>
  );
}
