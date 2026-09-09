import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Client ฐานข้อมูล
 *
 * ใช้ connection pooling ตามข้อกำหนด E3 — ในโหมด development เก็บ connection
 * ไว้บน globalThis เพื่อไม่ให้ hot reload เปิด connection ใหม่ทุกครั้งจนเต็ม pool
 *
 * ⚠️ ต้องสร้าง connection แบบ "ตอนใช้งานจริงครั้งแรก" เท่านั้น ห้ามสร้างตอน import
 *    ตอน build ของ Next.js จะ import ทุกไฟล์ route เข้ามาอ่านค่าที่ export ไว้
 *    ถ้าสร้าง connection ตั้งแต่ import แล้วยังไม่มี DATABASE_URL (ซึ่งเป็นเรื่องปกติ
 *    บนเครื่อง build เช่น Vercel) จะล้มด้วยข้อความ "Failed to collect page data"
 *    ทั้งที่โค้ดไม่มีอะไรผิด
 */
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const { DATABASE_URL, NODE_ENV } = getServerEnv();
  return postgres(DATABASE_URL, {
    max: NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // จำเป็นเมื่อต่อผ่าน connection pooler ของ Supabase
  });
}

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

let instance: Drizzle | null = null;

function getDb(): Drizzle {
  if (!instance) {
    const client = globalForDb.__pgClient ?? createClient();
    if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;
    instance = drizzle(client, { schema });
  }
  return instance;
}

/**
 * ใช้งานเหมือน drizzle ปกติทุกอย่าง เช่น db.select() · db.transaction()
 * แต่การเชื่อมต่อจริงจะเกิดตอนเรียกใช้ครั้งแรกเท่านั้น
 */
export const db = new Proxy({} as Drizzle, {
  get(_target, property) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    const value = target[property];
    // ผูก this กลับไปที่ instance จริง ไม่งั้นเมธอดอย่าง transaction() จะหา this ไม่เจอ
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export { schema };
export type Db = Drizzle;
