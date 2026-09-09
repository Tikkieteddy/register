import type { Config } from "drizzle-kit";

/**
 * ค่าตั้งของ drizzle-kit (ใช้ตอนสร้างและรัน migration)
 *
 * ⚠️ การรัน migration ต้องต่อแบบ session mode เท่านั้น
 *    Supabase ให้มา 2 เส้น:
 *      • DATABASE_URL (transaction pooler พอร์ต 6543) — สำหรับตัวเว็บบน Vercel
 *      • DIRECT_URL   (session mode พอร์ต 5432)      — สำหรับ migration
 *
 *    คำสั่ง DDL อย่าง CREATE TABLE ต้องใช้ session mode ไม่งั้นจะล้มกลางคัน
 *    จึงเลือก DIRECT_URL ก่อนเสมอ แล้วค่อยตกมาใช้ DATABASE_URL
 *    เมื่อไม่ได้ตั้งไว้ (เช่น ตอนพัฒนาในเครื่องที่ต่อ PostgreSQL ตรง ๆ)
 */
export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
} satisfies Config;
