import { z } from "zod";

/**
 * กฎตรวจสอบข้อมูลฟอร์มลงทะเบียน
 *
 * ⚠️ ไฟล์นี้ใช้ร่วมกันทั้งฝั่ง client และ server โดยตั้งใจ
 *    ฝั่ง client ใช้เพื่อแสดง error ทันทีให้ผู้ใช้
 *    ฝั่ง server ใช้ตรวจซ้ำอีกรอบเสมอ เพราะห้ามเชื่อข้อมูลจากฝั่ง client
 *    (ข้อกำหนดด้านความปลอดภัย)
 */

/** ข้อความ error มาตรฐานตามภาพอ้างอิง Zipevent */
export const REQUIRED = "โปรดระบุ";

// ------------------------------------------------------------------
// ฟิลด์พื้นฐาน
// ------------------------------------------------------------------

/** ชื่อ / นามสกุล — ไทยหรืออังกฤษ เว้นวรรค จุด ขีดกลาง */
const NAME_PATTERN = /^[฀-๿a-zA-Z\s.'-]+$/;

export const nameSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(100, "ความยาวต้องไม่เกิน 100 ตัวอักษร")
  .regex(NAME_PATTERN, "กรุณากรอกเป็นภาษาไทยหรือภาษาอังกฤษเท่านั้น");

export const emailSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(255, "อีเมลยาวเกินไป")
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  /** เก็บเป็นตัวพิมพ์เล็กเสมอ เพื่อให้ unique index กันอีเมลซ้ำทำงานถูกต้อง */
  .transform((v) => v.toLowerCase());

/**
 * เบอร์โทรศัพท์มือถือไทย
 *
 * รับได้ทั้ง 0812345678 / 081-234-5678 / 081 234 5678 / +66812345678
 * แล้วเก็บลงฐานข้อมูลเป็นตัวเลขล้วนขึ้นต้นด้วย 0 เสมอ
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .transform((v) => (v.startsWith("+66") ? `0${v.slice(3)}` : v))
  .transform((v) => (v.startsWith("66") && v.length === 11 ? `0${v.slice(2)}` : v))
  .refine(
    (v) => /^0\d{8,9}$/.test(v),
    "เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเป็นตัวเลข 9–10 หลัก",
  );

// ------------------------------------------------------------------
// คำตอบของคำถามที่ตั้งค่าได้จากหลังบ้าน
// ------------------------------------------------------------------

/** คำตอบ 1 ข้อ — เก็บทั้ง id ตัวเลือกที่ติ๊ก และข้อความของตัวเลือก "อื่นๆ ระบุ" */
export const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).default([]),
  otherText: z.string().trim().max(200, "ข้อความยาวเกินไป").optional(),
});

export type Answer = z.infer<typeof answerSchema>;

/** กติกาของคำถามที่ใช้ตรวจฝั่ง server (ดึงมาจากตาราง form_questions) */
export type QuestionRule = {
  id: string;
  labelTh: string;
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  hasOtherOption: boolean;
  otherOptionIds: string[];
};

/** ผลการตรวจคำตอบ 1 ข้อ — คืน null ถ้าผ่าน */
export function validateAnswer(rule: QuestionRule, answer: Answer | undefined): string | null {
  const selected = answer?.optionIds ?? [];

  if (rule.isRequired && selected.length === 0) {
    return rule.minSelect && rule.minSelect > 1
      ? `โปรดเลือกอย่างน้อย ${rule.minSelect} ข้อ`
      : REQUIRED;
  }
  if (selected.length === 0) return null;

  if (rule.minSelect !== null && selected.length < rule.minSelect) {
    return `โปรดเลือกอย่างน้อย ${rule.minSelect} ข้อ`;
  }
  if (rule.maxSelect !== null && selected.length > rule.maxSelect) {
    return `เลือกได้ไม่เกิน ${rule.maxSelect} ข้อ`;
  }

  // ถ้าติ๊ก "อื่นๆ" ต้องพิมพ์ข้อความมาด้วย
  const pickedOther = selected.some((id) => rule.otherOptionIds.includes(id));
  if (pickedOther && !answer?.otherText) {
    return "กรุณาระบุรายละเอียด";
  }

  return null;
}

// ------------------------------------------------------------------
// ฟอร์มลงทะเบียนทั้งใบ
// ------------------------------------------------------------------

export const registrationInputSchema = z.object({
  eventSlug: z.string().min(1),
  /** โทเคนที่ได้ตอนกดปุ่มลงทะเบียน ใช้ยืนยันว่าจองที่นั่งไว้จริง */
  holdTokens: z.array(z.string().uuid()).min(1, "การจองที่นั่งหมดอายุ กรุณาเริ่มใหม่อีกครั้ง"),

  // --- ข้อมูลผู้สั่งจอง ---
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  phoneCountryCode: z.string().default("+66"),

  // --- ช่วงเวลาที่เลือก ---
  sessionIds: z.array(z.string().uuid()).min(1, "โปรดเลือกช่วงเวลาที่ต้องการเข้าร่วม"),

  // --- คำตอบคำถามเพิ่มเติม ---
  answers: z.array(answerSchema).default([]),

  // --- ความยินยอม ---
  /** ข้อ A1.4 — checkbox บังคับติ๊ก */
  consentPhoto: z
    .boolean()
    .refine((v) => v, "กรุณายืนยันการยินยอมให้บันทึกภาพ เพื่อดำเนินการต่อ"),
  /** ข้อ D3 — radio ต้องเลือก "ยินยอม" */
  consentPdpa: z
    .boolean()
    .refine((v) => v, "กรุณาให้ความยินยอมการเก็บข้อมูลส่วนบุคคล เพื่อดำเนินการต่อ"),
  /** checkbox ในแถบสรุปด้านขวา */
  consentTerms: z
    .boolean()
    .refine((v) => v, "กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว"),
  /** ตัวเลือกเสริม ไม่บังคับ */
  saveForNextTime: z.boolean().default(false),

  // --- กัน bot ---
  /** ช่องซ่อนที่คนมองไม่เห็น ถ้ามีค่าแปลว่าเป็น bot */
  website: z.string().max(0, "ตรวจพบการส่งข้อมูลที่ผิดปกติ").optional().default(""),
  recaptchaToken: z.string().optional(),

  locale: z.enum(["th", "en"]).default("th"),
  shareLinkCode: z.string().max(20).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

export type RegistrationInput = z.input<typeof registrationInputSchema>;
export type RegistrationParsed = z.output<typeof registrationInputSchema>;

/** แปลง ZodError เป็น map ของ ชื่อฟิลด์ → ข้อความ error ภาษาไทย */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
