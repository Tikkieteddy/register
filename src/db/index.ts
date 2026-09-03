import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Client ฐานข้อมูล
 *
 * ใช้ connection pooling ตามข้อกำหนด E3 — ในโหมด development เก็บ connection
 * ไว้บน globalThis เพื่อไม่ให้ hot reload เปิด connection ใหม่ทุกครั้งจนเต็ม pool
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

const client = globalForDb.__pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
