"use client";

import { Field, inputClass } from "./Field";

export function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  helper,
  error,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  maxLength?: number;
}) {
  return (
    <Field id={id} label={label} required={required} helper={helper} error={error}>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        className={inputClass(Boolean(error))}
      />
    </Field>
  );
}

/**
 * ช่องเบอร์โทรพร้อมตัวเลือกรหัสประเทศ
 * ตามภาพอ้างอิง: ธงชาติและ +66 อยู่ในกรอบเดียวกับช่องกรอก คั่นด้วยเส้นแบ่ง
 */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  required = false,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  const countries = [
    { code: "+66", flag: "🇹🇭", name: "ไทย" },
    { code: "+65", flag: "🇸🇬", name: "สิงคโปร์" },
    { code: "+60", flag: "🇲🇾", name: "มาเลเซีย" },
    { code: "+856", flag: "🇱🇦", name: "ลาว" },
    { code: "+95", flag: "🇲🇲", name: "เมียนมา" },
    { code: "+855", flag: "🇰🇭", name: "กัมพูชา" },
    { code: "+84", flag: "🇻🇳", name: "เวียดนาม" },
    { code: "+81", flag: "🇯🇵", name: "ญี่ปุ่น" },
    { code: "+86", flag: "🇨🇳", name: "จีน" },
    { code: "+1", flag: "🇺🇸", name: "สหรัฐอเมริกา" },
    { code: "+44", flag: "🇬🇧", name: "สหราชอาณาจักร" },
  ];

  return (
    <Field id={id} label={label} required={required} error={error}>
      <div
        className={`flex items-stretch rounded-[var(--radius-control)] border overflow-hidden bg-surface ${
          error ? "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]" : "border-line-strong"
        }`}
      >
        <select
          aria-label="รหัสประเทศ"
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          className="bg-transparent pl-3 pr-2 text-ink border-r border-line-strong outline-none cursor-pointer"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          name={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={20}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="flex-1 min-h-[var(--control-height)] px-3 bg-transparent text-ink outline-none placeholder:text-muted"
          placeholder="08X XXX XXXX"
        />
      </div>
    </Field>
  );
}
