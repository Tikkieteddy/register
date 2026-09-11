"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { formOptions, formQuestions } from "@/db/schema";
import { getAdminOrNull, NOT_ADMIN_MESSAGE } from "@/lib/admin/guard";
import { pickFields, recordAudit } from "@/lib/audit";

export type QuestionResult = { ok: boolean; message: string };

/**
 * แก้คำถามในฟอร์มลงทะเบียน (หัวข้อ 3.2 แท็บ "คำถามในฟอร์ม")
 *
 * ⚠️ ห้ามเปลี่ยนค่า key ของคำถามหลังเปิดรับลงทะเบียนแล้ว
 *    เพราะ key คือสิ่งที่กราฟใน Dashboard ใช้อ้างถึงคำถาม
 *    ถ้าเปลี่ยน กราฟจะว่างเปล่าทันทีทั้งที่ข้อมูลยังอยู่ครบ
 */
export async function updateQuestionAction(input: {
  id: string;
  labelTh: string;
  helperTextTh: string;
  isRequired: boolean;
  isActive: boolean;
  minSelect: number | null;
  maxSelect: number | null;
}): Promise<QuestionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  if (!input.labelTh.trim()) return { ok: false, message: "โปรดระบุข้อความคำถาม" };

  const [before] = await db.select().from(formQuestions).where(eq(formQuestions.id, input.id));
  if (!before) return { ok: false, message: "ไม่พบคำถามนี้" };

  if (
    input.minSelect !== null &&
    input.maxSelect !== null &&
    input.minSelect > input.maxSelect
  ) {
    return { ok: false, message: "จำนวนขั้นต่ำต้องไม่มากกว่าจำนวนสูงสุด" };
  }

  await db
    .update(formQuestions)
    .set({
      labelTh: input.labelTh.trim(),
      helperTextTh: input.helperTextTh.trim() || null,
      isRequired: input.isRequired,
      isActive: input.isActive,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      updatedAt: new Date(),
    })
    .where(eq(formQuestions.id, input.id));

  await recordAudit({
    userId: admin.id,
    action: "update_settings",
    entityType: "form_question",
    entityId: input.id,
    before: pickFields(before, ["labelTh", "isRequired", "isActive", "minSelect", "maxSelect"]),
    after: {
      labelTh: input.labelTh,
      isRequired: input.isRequired,
      isActive: input.isActive,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
    },
  });

  revalidatePath("/admin-cms/settings");
  return { ok: true, message: "บันทึกคำถามเรียบร้อย" };
}

export async function addOptionAction(input: {
  questionId: string;
  labelTh: string;
  value: string;
}): Promise<QuestionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  const label = input.labelTh.trim();
  if (!label) return { ok: false, message: "โปรดระบุข้อความตัวเลือก" };

  // สร้าง value จากข้อความไทยไม่ได้ จึงให้ผู้ใช้กรอกเอง หรือใช้เลขลำดับแทน
  const value = input.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");

  const [last] = await db
    .select({ sortOrder: formOptions.sortOrder })
    .from(formOptions)
    .where(eq(formOptions.questionId, input.questionId))
    .orderBy(desc(formOptions.sortOrder))
    .limit(1);

  const nextOrder = (last?.sortOrder ?? 0) + 1;
  const finalValue = value || `option_${nextOrder}`;

  const clash = await db
    .select({ id: formOptions.id })
    .from(formOptions)
    .where(and(eq(formOptions.questionId, input.questionId), eq(formOptions.value, finalValue)));

  if (clash.length > 0) {
    return { ok: false, message: `รหัสตัวเลือก "${finalValue}" ถูกใช้ไปแล้วในคำถามนี้` };
  }

  const [created] = await db
    .insert(formOptions)
    .values({
      questionId: input.questionId,
      value: finalValue,
      labelTh: label,
      sortOrder: nextOrder,
    })
    .returning({ id: formOptions.id });

  await recordAudit({
    userId: admin.id,
    action: "create",
    entityType: "form_option",
    entityId: created?.id ?? null,
    after: { questionId: input.questionId, value: finalValue, labelTh: label },
  });

  revalidatePath("/admin-cms/settings");
  return { ok: true, message: `เพิ่มตัวเลือก “${label}” เรียบร้อย` };
}

/**
 * แก้ตัวเลือกและเปิด-ปิดการใช้งาน
 *
 * ⚠️ ไม่มีปุ่มลบตัวเลือกโดยตั้งใจ
 *    การลบจะทำให้คำตอบของคนที่เคยเลือกตัวเลือกนั้นหายไปจากกราฟทั้งหมด
 *    ใช้การปิดแทน — ตัวเลือกจะไม่ขึ้นในฟอร์มใหม่ แต่สถิติเดิมยังอยู่ครบ
 */
export async function updateOptionAction(input: {
  id: string;
  labelTh: string;
  isActive: boolean;
  sortOrder: number;
}): Promise<QuestionResult> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE };

  if (!input.labelTh.trim()) return { ok: false, message: "โปรดระบุข้อความตัวเลือก" };

  await db
    .update(formOptions)
    .set({
      labelTh: input.labelTh.trim(),
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    })
    .where(eq(formOptions.id, input.id));

  await recordAudit({
    userId: admin.id,
    action: "update",
    entityType: "form_option",
    entityId: input.id,
    after: { labelTh: input.labelTh, isActive: input.isActive, sortOrder: input.sortOrder },
  });

  revalidatePath("/admin-cms/settings");
  return { ok: true, message: "บันทึกตัวเลือกเรียบร้อย" };
}
