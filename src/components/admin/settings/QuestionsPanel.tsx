"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addOptionAction,
  updateOptionAction,
  updateQuestionAction,
} from "@/app/actions/admin/questions";
import { FIELD, Labeled, Notice } from "./fields";

export type QuestionRow = {
  id: string;
  key: string;
  labelTh: string;
  helperTextTh: string | null;
  type: string;
  isRequired: boolean;
  isActive: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  answerCount: number;
  options: {
    id: string;
    value: string;
    labelTh: string;
    isActive: boolean;
    sortOrder: number;
    answerCount: number;
  }[];
};

const TYPE_LABEL: Record<string, string> = {
  text: "พิมพ์ข้อความ",
  dropdown: "เลือกจากรายการ",
  radio: "เลือกได้ข้อเดียว",
  checkbox: "เลือกได้หลายข้อ",
  consent: "ช่องยินยอม",
};

/**
 * แท็บ "คำถามในฟอร์ม" (หัวข้อ 3.2)
 *
 * แสดงจำนวนคำตอบข้างทุกคำถามและทุกตัวเลือก เพื่อให้ผู้ดูแลเห็นก่อนแก้ว่า
 * การปิดตัวเลือกนี้จะกระทบข้อมูลของคนกี่คน
 */
export function QuestionsPanel({ questions }: { questions: QuestionRow[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(questions[0]?.id ?? null);

  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await work();
      setNotice({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <Notice notice={notice} />

      <p className="text-xs text-muted">
        ⚠️ รหัสอ้างอิงของคำถาม (key) เปลี่ยนไม่ได้หลังเปิดรับลงทะเบียนแล้ว
        เพราะกราฟใน Dashboard ใช้ค่านี้อ้างถึงคำถาม
      </p>

      {questions.map((question) => {
        const open = openId === question.id;
        return (
          <section
            key={question.id}
            className="border border-line rounded-[var(--radius-card)] bg-surface overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : question.id)}
              aria-expanded={open}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink truncate">
                  {question.labelTh}
                </span>
                <span className="block text-xs text-muted">
                  {TYPE_LABEL[question.type] ?? question.type} · รหัส {question.key} ·{" "}
                  {question.answerCount.toLocaleString("th-TH")} คำตอบ
                  {question.isActive ? "" : " · ปิดอยู่"}
                </span>
              </span>
              <span aria-hidden="true" className="text-muted shrink-0">
                {open ? "▲" : "▼"}
              </span>
            </button>

            {open ? (
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-line pt-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    const min = data.get("minSelect");
                    const max = data.get("maxSelect");
                    run(() =>
                      updateQuestionAction({
                        id: question.id,
                        labelTh: String(data.get("labelTh") ?? ""),
                        helperTextTh: String(data.get("helperTextTh") ?? ""),
                        isRequired: data.get("isRequired") === "on",
                        isActive: data.get("isActive") === "on",
                        minSelect: min ? Number(min) || null : null,
                        maxSelect: max ? Number(max) || null : null,
                      }),
                    );
                  }}
                  className="flex flex-col gap-3"
                >
                  <Labeled label="ข้อความคำถาม">
                    <input name="labelTh" defaultValue={question.labelTh} className={FIELD} />
                  </Labeled>

                  <Labeled
                    label="ข้อความช่วยเหลือใต้คำถาม"
                    hint="ข้อความตัวเล็กที่อธิบายเพิ่ม เช่น “เลือกได้สูงสุด 3 รายการ”"
                  >
                    <input
                      name="helperTextTh"
                      defaultValue={question.helperTextTh ?? ""}
                      className={FIELD}
                    />
                  </Labeled>

                  {question.type === "checkbox" ? (
                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                      <Labeled label="เลือกอย่างน้อย (ข้อ)">
                        <input
                          name="minSelect"
                          type="number"
                          min={0}
                          defaultValue={question.minSelect ?? ""}
                          className={FIELD}
                        />
                      </Labeled>
                      <Labeled label="เลือกได้สูงสุด (ข้อ)">
                        <input
                          name="maxSelect"
                          type="number"
                          min={1}
                          defaultValue={question.maxSelect ?? ""}
                          className={FIELD}
                        />
                      </Labeled>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="isRequired"
                        defaultChecked={question.isRequired}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      <span className="text-ink-2">บังคับตอบ</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={question.isActive}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      <span className="text-ink-2">แสดงคำถามนี้ในฟอร์ม</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={pending}
                    className="min-h-11 px-5 self-start rounded-[var(--radius-pill)] bg-primary text-primary-contrast text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                  >
                    บันทึกคำถาม
                  </button>
                </form>

                {question.options.length > 0 || question.type !== "text" ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-ink">ตัวเลือก</h3>

                    {question.options.map((option) => (
                      <form
                        key={option.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const data = new FormData(e.currentTarget);
                          run(() =>
                            updateOptionAction({
                              id: option.id,
                              labelTh: String(data.get("labelTh") ?? ""),
                              isActive: data.get("isActive") === "on",
                              sortOrder: Number(data.get("sortOrder") ?? 0),
                            }),
                          );
                        }}
                        className="flex flex-wrap items-end gap-2 border border-line rounded-[var(--radius-control)] p-2"
                      >
                        <input
                          name="labelTh"
                          defaultValue={option.labelTh}
                          className={`${FIELD} flex-1 min-w-[180px]`}
                        />
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue={option.sortOrder}
                          aria-label="ลำดับ"
                          className={`${FIELD} w-20`}
                        />
                        <label className="flex items-center gap-1.5 text-xs min-h-11">
                          <input
                            type="checkbox"
                            name="isActive"
                            defaultChecked={option.isActive}
                            className="size-4 accent-[var(--color-primary)]"
                          />
                          <span className="text-ink-2">แสดง</span>
                        </label>
                        <span className="text-xs text-muted tabular-nums min-h-11 flex items-center">
                          {option.answerCount} คำตอบ
                        </span>
                        <button
                          type="submit"
                          disabled={pending}
                          className="min-h-11 px-3 rounded-[var(--radius-control)] border border-line text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                        >
                          บันทึก
                        </button>
                      </form>
                    ))}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formEl = e.currentTarget;
                        const data = new FormData(formEl);
                        run(async () => {
                          const result = await addOptionAction({
                            questionId: question.id,
                            labelTh: String(data.get("labelTh") ?? ""),
                            value: String(data.get("value") ?? ""),
                          });
                          if (result.ok) formEl.reset();
                          return result;
                        });
                      }}
                      className="flex flex-wrap items-end gap-2 border border-dashed border-line-strong rounded-[var(--radius-control)] p-2"
                    >
                      <input
                        name="labelTh"
                        placeholder="ข้อความตัวเลือกใหม่"
                        className={`${FIELD} flex-1 min-w-[180px]`}
                      />
                      <input
                        name="value"
                        placeholder="รหัส (a-z, ตัวเลข)"
                        className={`${FIELD} w-40`}
                      />
                      <button
                        type="submit"
                        disabled={pending}
                        className="min-h-11 px-3 rounded-[var(--radius-control)] border border-primary text-xs text-primary-dark font-semibold hover:bg-primary-light disabled:opacity-50"
                      >
                        เพิ่มตัวเลือก
                      </button>
                    </form>

                    <p className="text-xs text-muted">
                      ระบบไม่มีปุ่มลบตัวเลือก — การลบจะทำให้คำตอบของคนที่เคยเลือกหายจากกราฟทั้งหมด
                      ให้ติ๊ก “แสดง” ออกแทน ตัวเลือกจะไม่ขึ้นในฟอร์มใหม่ แต่สถิติเดิมยังอยู่ครบ
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}

      {questions.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีคำถามเพิ่มเติมในฟอร์ม</p>
      ) : null}
    </div>
  );
}
