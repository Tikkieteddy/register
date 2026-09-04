"use client";

/**
 * เสียงและการสั่นเวลาสแกนเสร็จ
 *
 * สำคัญมากหน้างานจริง — เจ้าหน้าที่จะรู้ผลได้โดยไม่ต้องก้มมองจอ
 * ทำให้สแกนได้เร็วขึ้นมากตอนคิวยาว
 *
 * ใช้ Web Audio API สร้างเสียงเอง แทนการโหลดไฟล์เสียง
 * เพราะต้องทำงานได้ตอนออฟไลน์ด้วย
 */
type Tone = "success" | "duplicate" | "invalid";

const PATTERNS: Record<Tone, { freq: number; duration: number; gap: number; times: number }> = {
  success: { freq: 1_050, duration: 90, gap: 0, times: 1 },
  duplicate: { freq: 700, duration: 110, gap: 90, times: 2 },
  invalid: { freq: 320, duration: 380, gap: 0, times: 1 },
};

const VIBRATION: Record<Tone, number[]> = {
  success: [60],
  duplicate: [60, 80, 60],
  invalid: [220],
};

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    audioContext ??= new AudioContext();
    // เบราว์เซอร์บนมือถือ suspend ไว้จนกว่าผู้ใช้จะแตะจอ
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

export function playFeedback(tone: Tone): void {
  const pattern = PATTERNS[tone];

  try {
    navigator.vibrate?.(VIBRATION[tone]);
  } catch {
    // อุปกรณ์ไม่รองรับการสั่น — ไม่เป็นไร
  }

  const ctx = getContext();
  if (!ctx) return;

  for (let i = 0; i < pattern.times; i++) {
    const startAt = ctx.currentTime + (i * (pattern.duration + pattern.gap)) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = pattern.freq;
    // ค่อย ๆ ลดเสียงลงเพื่อไม่ให้มีเสียงป๊อกตอนตัด
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + pattern.duration / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + pattern.duration / 1000 + 0.02);
  }
}

/** ปลุก AudioContext ตอนผู้ใช้แตะจอครั้งแรก ไม่งั้นเสียงจะไม่ดังบนมือถือ */
export function primeAudio(): void {
  getContext();
}
