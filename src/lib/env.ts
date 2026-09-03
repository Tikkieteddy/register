import { z } from "zod";

/**
 * ตรวจสอบ environment variables ตั้งแต่ตอนเริ่มระบบ
 * ถ้าตั้งค่าไม่ครบจะล้มทันทีพร้อมบอกว่าขาดตัวไหน แทนที่จะไปพังตอนใช้งานจริง
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL ต้องเป็น connection string ของ PostgreSQL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),

  RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),

  /** ใช้แฮช IP และ visitor id — ห้ามเก็บ IP ดิบตามข้อกำหนด PDPA */
  HASH_SALT: z.string().min(16, "HASH_SALT ต้องยาวอย่างน้อย 16 ตัวอักษร").optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cachedServerEnv: ServerEnv | null = null;

/** เรียกได้เฉพาะฝั่งเซิร์ฟเวอร์เท่านั้น */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `ตั้งค่า environment variables ไม่ถูกต้อง — ดูตัวอย่างที่ .env.example\n${format(parsed.error)}`,
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
});
