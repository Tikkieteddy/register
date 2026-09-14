"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * คำแนะนำการใช้งานสำหรับคนเข้าครั้งแรก — ชี้ปุ่มทีละจุดพร้อมคำอธิบาย
 *
 * ทำไมเขียนเองแทนใช้ไลบรารีสำเร็จรูป:
 *   ไลบรารีที่มีอยู่ผูกกับภาษาอังกฤษและรูปแบบที่ปรับยาก
 *   ส่วนนี้ต้องอ่านเป็นภาษาไทย ใช้บนมือถือหน้างานได้ และพึ่งพาให้น้อยที่สุด
 *   เพราะเป็นระบบที่ต้องดูแลต่อยาว ๆ โดยคนที่อาจไม่ใช่นักพัฒนา
 *
 * ⚠️ ต้องไม่ขวางการทำงานเด็ดขาด
 *    ถ้าหาปุ่มที่จะชี้ไม่เจอ (หน้าจอเปลี่ยน หรือยังโหลดไม่เสร็จ) ให้ข้ามข้อนั้นไปเอง
 *    ห้ามค้างรอจนคนใช้งานต่อไม่ได้
 */

export type TourStep = {
  /** ตัวชี้เป้าของปุ่มที่จะไฮไลต์ — ไม่ใส่ = แสดงกล่องกลางจอ (ใช้กับข้อทักทาย) */
  target?: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number };

/** ระยะเผื่อรอบปุ่มที่ไฮไลต์ ให้เห็นขอบชัดโดยไม่ชิดเกินไป */
const PAD = 8;

export function Tour({
  steps,
  storageKey,
  autoStart = true,
}: {
  steps: TourStep[];
  /** กุญแจจำว่าเคยดูจบแล้ว — ต้องไม่ซ้ำกันระหว่างส่วนงาน */
  storageKey: string;
  autoStart?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /**
   * เปิดอัตโนมัติเฉพาะคนที่ยังไม่เคยดู
   *
   * อ่าน localStorage ใน useEffect ไม่ใช่ตอนสร้างสถานะ เพราะฝั่งเซิร์ฟเวอร์ไม่มี
   * localStorage ถ้าอ่านตอนสร้างจะทำให้หน้าเว็บที่เซิร์ฟเวอร์วาดไว้ไม่ตรงกับฝั่งเบราว์เซอร์
   */
  useEffect(() => {
    if (!autoStart) return;

    /**
     * รอให้หน้าวาดเสร็จก่อนค่อยเปิด — ไม่ใช่แค่เลี่ยงกฎของ lint แต่จำเป็นจริง
     *
     * ถ้าเปิดทันทีที่คอมโพเนนต์เกิด ปุ่มที่จะชี้อาจยังไม่ขึ้นบนหน้าจอ
     * คำแนะนำจะหาเป้าไม่เจอแล้วแสดงเป็นกล่องกลางจอแทน ซึ่งไม่ได้ช่วยอะไร
     */
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem(storageKey)) setOpen(true);
      } catch {
        // เบราว์เซอร์บางตัวปิดการเก็บข้อมูลไว้ — ไม่ต้องเปิดคำแนะนำ ดีกว่าเปิดซ้ำทุกครั้ง
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [autoStart, storageKey]);

  const finish = useCallback(() => {
    setOpen(false);
    setIndex(0);
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      // จำไม่ได้ก็ไม่เป็นไร แค่คำแนะนำจะขึ้นอีกครั้งหน้า
    }
  }, [storageKey]);

  /**
   * ข้ามข้อที่ชี้ไปยังปุ่มซึ่งไม่มีอยู่บนหน้าจอตอนนั้น
   *
   * ⚠️ จำเป็น ไม่ใช่ของแถม
   *    บางปุ่มแสดงเฉพาะบางสถานการณ์ เช่น ตัวสลับงานจะโผล่ก็ต่อเมื่อมีงานตั้งแต่ 2 งานขึ้นไป
   *    ถ้าไม่ข้าม คำแนะนำจะอธิบายปุ่มที่ผู้ใช้มองไม่เห็น ซึ่งสับสนกว่าไม่พูดถึงเลย
   *
   * ข้อที่ไม่มี target (ข้อทักทาย) ไม่เข้าเงื่อนไขนี้ แสดงเป็นกล่องกลางจอตามปกติ
   */
  const visibleSteps = steps.filter((s) => {
    if (!s.target) return true;
    if (typeof document === "undefined") return true;
    return document.querySelector(s.target) !== null;
  });

  const activeSteps = visibleSteps.length > 0 ? visibleSteps : steps;
  const step = activeSteps[index];

  /** หาตำแหน่งปุ่มที่จะไฮไลต์ และเลื่อนจอไปให้เห็น */
  useEffect(() => {
    if (!open || !step) return;

    let cancelled = false;

    const locate = () => {
      if (cancelled) return;
      if (!step.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        // หาไม่เจอ — แสดงเป็นกล่องกลางจอแทน ไม่ปล่อยให้ค้าง
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    locate();
    // หาซ้ำอีกครั้งหลังเลื่อนจอเสร็จ เพราะตำแหน่งเปลี่ยนระหว่างเลื่อน
    const timer = setTimeout(locate, 350);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  }, [open, step, index]);

  // ปิดด้วยปุ่ม Esc ได้ตลอด — คนที่ไม่อยากดูต้องออกได้ทันที
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, activeSteps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, activeSteps.length]);

  // ย้ายโฟกัสมาที่กล่องคำแนะนำ เพื่อให้คนที่ใช้แป้นพิมพ์หรือโปรแกรมอ่านหน้าจอตามทัน
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open, index]);

  if (!open || !step) return null;

  const isLast = index === activeSteps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="คำแนะนำการใช้งาน"
      className="fixed inset-0 z-[100]"
    >
      {/* ฉากมืดคลุมทั้งจอ — เจาะช่องให้เห็นปุ่มที่กำลังแนะนำ */}
      <div className="absolute inset-0 bg-[rgba(28,23,20,0.6)]" onClick={finish} aria-hidden="true" />

      {rect && (
        <div
          aria-hidden="true"
          className="absolute rounded-[var(--radius-control)] pointer-events-none
            ring-4 ring-[color:var(--color-primary)]
            shadow-[0_0_0_9999px_rgba(28,23,20,0.6)]"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      )}

      <div
        ref={boxRef}
        tabIndex={-1}
        className="absolute left-1/2 -translate-x-1/2 w-[min(28rem,calc(100vw-2rem))]
          bg-surface rounded-[var(--radius-card)] border border-line shadow-xl p-5
          flex flex-col gap-3 outline-none"
        style={placeBox(rect)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{step.title}</h2>
          <span className="text-xs text-muted shrink-0 tabular-nums mt-0.5">
            {index + 1}/{activeSteps.length}
          </span>
        </div>

        <p className="text-sm text-ink-2 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-muted hover:text-ink-2 underline min-h-11 px-1"
          >
            ข้ามคำแนะนำ
          </button>

          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-line
                  text-sm text-ink-2 hover:bg-surface-2"
              >
                ย้อนกลับ
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-primary text-primary-contrast
                text-sm font-semibold hover:bg-primary-dark"
            >
              {isLast ? "เริ่มใช้งาน" : "ถัดไป"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * วางกล่องคำอธิบายไม่ให้ทับปุ่มที่กำลังชี้
 * ถ้าปุ่มอยู่ครึ่งบนของจอ วางกล่องไว้ข้างล่าง ถ้าอยู่ครึ่งล่างก็วางไว้ข้างบน
 */
function placeBox(rect: Rect | null): React.CSSProperties {
  if (!rect) return { top: "50%", transform: "translate(-50%, -50%)" };
  const viewportH = typeof window === "undefined" ? 800 : window.innerHeight;
  const below = rect.top + rect.height + PAD + 16;
  const isTopHalf = rect.top + rect.height / 2 < viewportH / 2;
  return isTopHalf
    ? { top: Math.min(below, viewportH - 40) }
    : { bottom: Math.min(viewportH - rect.top + PAD + 16, viewportH - 40) };
}
