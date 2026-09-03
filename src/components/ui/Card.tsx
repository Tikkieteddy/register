import type { ReactNode } from "react";

/**
 * การ์ดพื้นขาว มุมมน เงาอ่อน
 *
 * accent = true จะมีแถบสีตั้งบาง ๆ ชิดขอบซ้าย
 * ซึ่งเป็นจุดเด่นของดีไซน์ในภาพอ้างอิง (การ์ดข้อมูลผู้ลงทะเบียน และการ์ดตั๋ว)
 */
export function Card({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface border border-line rounded-[var(--radius-card)] shadow-[0_1px_2px_rgba(28,23,20,0.04)] overflow-hidden ${
        accent ? "border-l-[3px] border-l-primary" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base sm:text-lg font-semibold text-ink mb-4">{children}</h2>;
}
