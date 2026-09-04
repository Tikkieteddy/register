import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { getServerEnv } from "@/lib/env";

/**
 * ระบบส่งอีเมล — แยกเป็น adapter เพื่อให้เปลี่ยนผู้ให้บริการได้โดยแก้ไฟล์เดียว
 *
 * ตามหัวข้อ 8.2: ผู้ใช้เห็นหน้าเสร็จสิ้นพร้อม QR ภายใน < 1 วินาที
 * แล้วอีเมลตามไปทีหลัง < 30 วินาที ถ้าส่งไม่สำเร็จ retry 3 ครั้ง
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string };

interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

/** ส่งจริงผ่าน Resend */
class ResendAdapter implements EmailAdapter {
  readonly name = "resend";
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, providerMessageId: data?.id ?? null };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/**
 * ตัวสำรองตอนยังไม่ได้ตั้งค่า RESEND_API_KEY
 *
 * ⚠️ ไม่ได้ส่งอีเมลจริง แค่บันทึกไว้ใน log ให้ทดสอบ flow ได้
 *    ต้องตั้ง RESEND_API_KEY ก่อนเปิดใช้งานจริงเสมอ
 */
class ConsoleAdapter implements EmailAdapter {
  readonly name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    console.warn(
      `[email] ยังไม่ได้ตั้งค่า RESEND_API_KEY — ไม่ได้ส่งอีเมลจริง\n` +
        `        ถึง: ${message.to}\n` +
        `        หัวข้อ: ${message.subject}\n` +
        `        ไฟล์แนบ: ${message.attachments?.length ?? 0} ไฟล์`,
    );
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }
}

let cachedAdapter: EmailAdapter | null = null;

function getAdapter(): EmailAdapter {
  if (cachedAdapter) return cachedAdapter;
  const env = getServerEnv();
  cachedAdapter =
    env.RESEND_API_KEY && env.EMAIL_FROM
      ? new ResendAdapter(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleAdapter();
  return cachedAdapter;
}

/** ระยะเวลารอก่อน retry แต่ละครั้ง — 2 วิ, 10 วิ, 60 วิ ตามหัวข้อ 8.2 */
const RETRY_DELAYS_MS = [2_000, 10_000, 60_000];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ส่งอีเมลพร้อม retry และบันทึกสถานะทุกครั้งลง email_logs
 *
 * เรียกแบบไม่ await ได้ เพราะออกแบบให้ไม่โยน error ออกมา
 * ความล้มเหลวจะถูกบันทึกไว้ให้ Admin เห็นและกดส่งซ้ำได้แทน
 */
export async function sendWithRetry(params: {
  registrationId: string | null;
  template: string;
  message: EmailMessage;
}): Promise<{ logId: number; sent: boolean }> {
  const adapter = getAdapter();

  const [log] = await db
    .insert(emailLogs)
    .values({
      registrationId: params.registrationId,
      toEmail: params.message.to,
      template: params.template,
      provider: adapter.name,
      status: "queued",
    })
    .returning({ id: emailLogs.id });

  if (!log) throw new Error("สร้าง email log ไม่สำเร็จ");

  let lastError = "";

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const result = await adapter.send(params.message);

    if (result.ok) {
      await db
        .update(emailLogs)
        .set({
          status: "sent",
          providerMessageId: result.providerMessageId,
          attemptCount: attempt,
          sentAt: new Date(),
        })
        .where(eq(emailLogs.id, log.id));
      return { logId: log.id, sent: true };
    }

    lastError = result.error;
    await db
      .update(emailLogs)
      .set({ attemptCount: attempt, lastError })
      .where(eq(emailLogs.id, log.id));

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay !== undefined) await wait(delay);
  }

  await db
    .update(emailLogs)
    .set({ status: "failed", lastError })
    .where(eq(emailLogs.id, log.id));

  console.error(`[email] ส่งไม่สำเร็จหลัง retry ครบแล้ว ถึง ${params.message.to}: ${lastError}`);
  return { logId: log.id, sent: false };
}

/** ใช้ในหน้า Admin เพื่อบอกว่าตอนนี้ระบบส่งอีเมลพร้อมใช้งานจริงหรือยัง */
export function isEmailConfigured(): boolean {
  return getAdapter().name !== "console";
}
