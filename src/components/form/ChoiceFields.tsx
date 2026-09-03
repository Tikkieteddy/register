"use client";

import { Field, inputClass } from "./Field";

export type Choice = {
  id: string;
  label: string;
  isOther?: boolean;
  disabled?: boolean;
  disabledNote?: string;
};

/** dropdown สำหรับคำถามที่มีตัวเลือกเยอะ — ค่าเริ่มต้นแสดง ----- ตามภาพอ้างอิง */
export function SelectField({
  id,
  label,
  choices,
  value,
  onChange,
  required = false,
  error,
  placeholder = "-----",
}: {
  id: string;
  label: string;
  choices: Choice[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  return (
    <Field id={id} label={label} required={required} error={error}>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass(Boolean(error))} cursor-pointer appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%23857a71' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">{placeholder}</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * กลุ่มตัวเลือก จัด 2 คอลัมน์ตามภาพอ้างอิง
 * รองรับทั้ง radio (เลือกได้ 1) และ checkbox (เลือกได้หลายข้อ)
 */
export function ChoiceGroup({
  id,
  label,
  choices,
  selected,
  onToggle,
  multiple,
  required = false,
  error,
  helper,
  maxSelect,
  otherText,
  onOtherTextChange,
  otherPlaceholder = "โปรดระบุ",
}: {
  id: string;
  label: string;
  choices: Choice[];
  selected: string[];
  onToggle: (choiceId: string) => void;
  multiple: boolean;
  required?: boolean;
  error?: string;
  helper?: string;
  maxSelect?: number | null;
  otherText?: string;
  onOtherTextChange?: (v: string) => void;
  otherPlaceholder?: string;
}) {
  // ครบจำนวนสูงสุดแล้ว ตัวเลือกที่เหลือต้องกดไม่ได้ — บังคับเงื่อนไขจริงตามข้อกำหนด D3
  const atMax = multiple && maxSelect != null && selected.length >= maxSelect;
  const otherPicked = choices.some((c) => c.isOther && selected.includes(c.id));

  return (
    <Field
      id={id}
      label={label}
      required={required}
      error={error}
      errorPosition="above"
      helper={helper}
    >
      <div
        role={multiple ? "group" : "radiogroup"}
        aria-labelledby={`${id}-label`}
        className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-1"
      >
        {choices.map((c) => {
          const isSelected = selected.includes(c.id);
          const blockedByMax = atMax && !isSelected;
          const disabled = c.disabled || blockedByMax;

          return (
            <label
              key={c.id}
              className={`flex items-start gap-2.5 text-ink ${
                disabled ? "text-muted cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={multiple ? `${id}-${c.id}` : id}
                value={c.id}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onToggle(c.id)}
                className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary)] disabled:cursor-not-allowed"
              />
              <span>
                {c.label}
                {c.disabled && c.disabledNote && (
                  <span className="text-danger text-sm ms-2">({c.disabledNote})</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {/* ติ๊ก "อื่นๆ" แล้วจึงโผล่ช่องให้พิมพ์เอง */}
      {otherPicked && onOtherTextChange && (
        <input
          type="text"
          value={otherText ?? ""}
          onChange={(e) => onOtherTextChange(e.target.value)}
          placeholder={otherPlaceholder}
          maxLength={200}
          aria-label={`${label} — ระบุเพิ่มเติม`}
          className={`${inputClass(false)} mt-3`}
        />
      )}
    </Field>
  );
}

/** checkbox เดี่ยว ใช้กับข้อความยินยอมและตัวเลือกเสริม */
export function CheckboxRow({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <label className="flex items-start gap-2.5 cursor-pointer text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
        <span className="text-sm leading-relaxed">{children}</span>
      </label>
    </div>
  );
}
