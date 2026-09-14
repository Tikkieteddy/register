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

/**
 * ปุ่มนี้ "มองเห็นได้จริง" บนหน้าจอตอนนี้หรือไม่
 *
 * ⚠️ ห้ามเช็คแค่ว่ามีอยู่ใน DOM หรือไม่ — เคยพลาดมาแล้ว
 *
 *    ปุ่มหลายตัวถูกซ่อนตามขนาดจอ เช่นปุ่มเปิดเมนูที่โผล่เฉพาะบนมือถือ
 *    ถ้าเช็คแค่ querySelector จะเจอ element นั้นอยู่ดีทั้งที่คนมองไม่เห็น
 *    คำแนะนำก็จะไปชี้ที่ว่างเปล่า แล้วดูเหมือนระบบพัง
 *
 *    วัดจากขนาดจริงที่เบราว์เซอร์คำนวณให้ ซึ่งเป็น 0 เมื่อถูกซ่อนด้วย display:none
 */
function isVisible(el: Element | null): el is Element {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

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
    return isVisible(document.querySelector(s.target));
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
      if (!isVisible(el)) {
        // หาไม่เจอหรือถูกซ่อนอยู่ — แสดงเป็นกล่องกลางจอแทน ไม่ปล่อยให้ค้าง
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
      {/*
        ฉากคลุมทั้งจอ — เทาเข้มโปร่งแสงพร้อมเบลอฉากหลังเล็กน้อย
        ใช้เทากลางแทนดำสนิท เพื่อให้เนื้อหาข้างหลังยังพอเห็นเป็นบริบทได้
        คนจะได้รู้ว่าตัวเองอยู่หน้าไหน ไม่ใช่เหมือนโดนบังจนมืดทั้งจอ
      */}
      <div
        className="absolute inset-0 bg-[rgba(46,41,38,0.55)] backdrop-blur-[2px]"
        onClick={finish}
        aria-hidden="true"
      />

      {rect && (
        <div
          aria-hidden="true"
          className="absolute rounded-[var(--radius-control)] pointer-events-none
            ring-2 ring-white/70 ring-offset-2 ring-offset-transparent
            shadow-[0_0_0_9999px_rgba(46,41,38,0.55),0_0_24px_6px_rgba(255,255,255,0.25)]"
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
          rounded-[var(--radius-card)] p-5 flex flex-col gap-3 outline-none
          bg-[rgba(32,28,26,0.82)] backdrop-blur-xl
          border border-white/15
          shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)]
          text-white"
        style={placeBox(rect)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{step.title}</h2>
          <span className="text-xs text-white/60 shrink-0 tabular-nums mt-0.5">
            {index + 1}/{activeSteps.length}
          </span>
        </div>

        <p className="text-sm text-white/85 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-white/55 hover:text-white/85 underline min-h-11 px-1"
          >
            ข้ามคำแนะนำ
          </button>

          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                className="min-h-11 px-4 rounded-[var(--radius-pill)] border border-white/25
                  text-sm text-white/85 hover:bg-white/10 transition-colors"
              >
                ย้อนกลับ
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="min-h-11 px-5 rounded-[var(--radius-pill)] bg-white text-[#201c1a]
                text-sm font-semibold hover:bg-white/90 transition-colors"
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
