import type { Metadata, Viewport } from "next";
import { Anuphan, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

/**
 * ฟอนต์ต้องรองรับภาษาไทยและอ่านง่ายตามข้อกำหนดด้านการออกแบบ
 *
 * โหลดผ่าน next/font เพื่อให้ self-host อัตโนมัติ ไม่ต้องเรียกไปที่เซิร์ฟเวอร์ของ Google
 * ซึ่งช่วยทั้งความเร็ว (LCP) ความเป็นส่วนตัวของผู้ใช้ และทำให้ผ่านกฎ CSP
 * ที่อนุญาตให้โหลดฟอนต์จากโดเมนตัวเองเท่านั้น
 *
 * Anuphan — หัวข้อ · ทรงเรขาคณิต ปลายตัดตรง ดูสมัยใหม่ ไม่มีหัวกลมแบบฟอนต์ราชการ
 * Noto Sans Thai — เนื้อความ · ออกแบบมาเพื่อการอ่านยาว ๆ วรรณยุกต์ไม่ชนกันแม้ตัวเล็ก
 */
const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-anuphan",
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-thai",
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
    <html lang="th" className={`${anuphan.variable} ${notoThai.variable}`}>
      <body>{children}</body>
    </html>
  );
}
