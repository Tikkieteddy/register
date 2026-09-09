import { loadEnvConfig } from "@next/env";

/**
 * โหลดค่าจากไฟล์ .env.local เข้ามาใน process.env
 *
 * ⚠️ จำเป็นสำหรับสคริปต์ที่รันนอก Next.js เท่านั้น (migration · seed · สคริปต์ทดสอบ)
 *    เพราะ Next.js โหลดไฟล์ .env ให้เองเฉพาะตอนรันเว็บ
 *    แต่ drizzle-kit และ tsx ไม่ได้โหลดให้ ทำให้ขึ้น error ว่า url เป็นค่าว่าง
 *
 * ใช้ loadEnvConfig ของ Next.js ที่ติดมากับโปรเจกต์อยู่แล้ว
 * จะได้ลำดับความสำคัญของไฟล์ (.env.local ทับ .env) เหมือนกับตอนรันเว็บเป๊ะ ๆ
 * และไม่ต้องเพิ่ม dependency ใหม่
 *
 * วิธีใช้: import ไฟล์นี้เป็นบรรทัดแรกสุดของสคริปต์
 *   import "@/lib/load-env";
 */
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
