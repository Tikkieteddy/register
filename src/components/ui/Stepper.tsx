import type { Dictionary } from "@/i18n/dictionaries";

/**
 * แถบขั้นตอน 3 ช่อง ตามข้อกำหนด D2 และภาพอ้างอิงที่ 2
 *
 * รายละเอียดที่ถอดจากภาพ: ข้อความอยู่ "เหนือ" แถบ ไม่ใช่ในแถบ
 * ขั้นที่ผ่านแล้วและขั้นปัจจุบันเป็นแถบทึบ ขั้นที่ยังไม่ถึงเป็นแถบสีอ่อน
 */
export function Stepper({ current, dict }: { current: 1 | 2 | 3; dict: Dictionary }) {
  const steps = [dict.stepper.event, dict.stepper.register, dict.stepper.done];

  return (
    <nav aria-label="ขั้นตอนการลงทะเบียน" className="w-full">
      <ol className="flex gap-2 sm:gap-3">
        {steps.map((label, i) => {
          const stepNo = i + 1;
          const reached = stepNo <= current;
          return (
            <li key={label} className="flex-1 flex flex-col gap-2">
              <span
                className={`text-center text-xs sm:text-sm font-medium ${
                  reached ? "text-primary-dark" : "text-muted"
                }`}
                aria-current={stepNo === current ? "step" : undefined}
              >
                {label}
              </span>
              <span
                className={`h-1.5 rounded-[var(--radius-pill)] ${
                  reached ? "bg-primary" : "bg-primary-light"
                }`}
              />
              <span className="sr-only">
                {stepNo === current ? "ขั้นตอนปัจจุบัน" : reached ? "ผ่านแล้ว" : "ยังไม่ถึง"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
