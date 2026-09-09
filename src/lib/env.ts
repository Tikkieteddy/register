import { z } from "zod";

/**
 * ตรวจสอบ environment variables ตั้งแต่ตอนเริ่มระบบ
 * ถ้าตั้งค่าไม่ครบจะล้มทันทีพร้อมบอกว่าขาดตัวไหน แทนที่จะไปพังตอนใช้งานจริง
 */
const serverSchema = z.object({
  DATABASE_URL: z
    .string({ error: "ยังไม่ได้ตั้งค่า DATABASE_URL — ต้องตั้งบน Vercel ด้วย ไม่ใช่แค่ในเครื่อง" })
    .url("DATABASE_URL ต้องเป็น connection string ของ PostgreSQL"),

  /**
   * เส้นทางต่อฐานข้อมูลแบบ session mode (พอร์ต 5432) ที่ Supabase ให้มาคู่กัน
   * ใช้เฉพาะตอนรัน migration เท่านั้น ตัวเว็บไม่ได้ใช้ค่านี้
   */
  DIRECT_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),

  RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),

  /**
   * ที่เก็บไฟล์ภาพ (Cloudflare R2)
   * ต้องครบทั้ง 5 ตัวจึงจะใช้งานได้ ถ้าไม่ครบตอนพัฒนาจะเขียนลง public/uploads แทน
   */
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),

  /** ใช้แฮช IP และ visitor id — ห้ามเก็บ IP ดิบตามข้อกำหนด PDPA */
  HASH_SALT: z.string().min(16, "HASH_SALT ต้องยาวอย่างน้อย 16 ตัวอักษร").optional(),

  /** ใช้ยืนยันว่าคำขอ cron มาจาก Vercel จริง ไม่ใช่คนภายนอกยิงเข้ามา */
  CRON_SECRET: z.string().min(16).optional(),

  /** ใช้เซ็น session ของเจ้าหน้าที่และผู้ดูแลระบบ */
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร")
    .optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * ตัดตัวแปรที่มีค่าเป็นสตริงว่างทิ้งก่อนตรวจสอบ
 *
 * ⚠️ จำเป็นมากตอน deploy บน Vercel
 *    ตอน import โปรเจกต์ Vercel จะอ่าน "รายชื่อ" ตัวแปรจาก .env.example มาสร้างให้อัตโนมัติ
 *    โดยกำหนดค่าเป็นสตริงว่าง ("") ไม่ใช่ปล่อยให้ไม่มีตัวแปรนั้นเลย
 *
 *    แต่ .optional() ของ zod ยอมรับเฉพาะ undefined เท่านั้น ไม่ยอมรับ ""
 *    ตัวแปรที่ตั้งใจให้ไม่บังคับ (Resend · R2 · reCAPTCHA) จึงล้มยกชุด
 *    ทั้งที่ระบบยังไม่ได้ใช้งานส่วนนั้นเลย และเว็บขึ้น "Application error" ทั้งหน้า
 *
 *    การมองว่า "ตั้งค่าว่างไว้ = ยังไม่ได้ตั้งค่า" เป็นพฤติกรรมที่ถูกต้องกว่าอยู่แล้ว
 */
function withoutEmpty(source: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim() !== "") result[key] = value;
  }
  return result;
}

/** ใช้กับค่าฝั่ง client ที่ต้องอ้างชื่อตัวแปรตรง ๆ (Next.js แทนค่าให้ตอน build) */
function orUndefined(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cachedServerEnv: ServerEnv | null = null;

/** เรียกได้เฉพาะฝั่งเซิร์ฟเวอร์เท่านั้น */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(withoutEmpty(process.env));
  if (!parsed.success) {
    throw new Error(
      `ตั้งค่า environment variables ไม่ถูกต้อง — ดูตัวอย่างที่ .env.example\n${format(parsed.error)}`,
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_SITE_URL: orUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: orUndefined(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
});
