// โหลด .env.local ก่อน เพราะสคริปต์นี้รันนอก Next.js
import "../src/lib/load-env";
import { readFileSync } from "node:fs";

/**
 * ตรวจค่าความต่างของสี (contrast) ตามมาตรฐาน WCAG 2.1 ระดับ AA
 *
 * รันด้วย: npm run check:contrast
 *
 * ทำไมต้องตรวจ:
 *   ผู้เข้าร่วมงานจำนวนมากเปิดหน้าเว็บกลางแดดบนมือถือ ซึ่งมองจอยากอยู่แล้ว
 *   ถ้าสีตัวหนังสือกับพื้นหลังต่างกันน้อย จะอ่านไม่ออกเลย
 *   และเป็นข้อกำหนดของหน่วยงานราชการไทยสำหรับเว็บที่ประชาชนต้องใช้
 *
 * เกณฑ์ AA:
 *   • ตัวหนังสือขนาดปกติ  ≥ 4.5 : 1
 *   • ตัวหนังสือขนาดใหญ่  ≥ 3.0 : 1  (ตั้งแต่ 18.66px ตัวหนา หรือ 24px ขึ้นไป)
 *   • ขอบและไอคอนที่สื่อความหมาย ≥ 3.0 : 1
 */

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** ความสว่างสัมพัทธ์ตามสูตรของ WCAG */
function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** อ่านค่าสีจาก globals.css เพื่อให้ตรวจของจริงเสมอ ไม่ใช่ค่าที่ก็อปมาแปะไว้ */
function readTokens(): Map<string, string> {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})/g)) {
    if (match[1] && match[2]) tokens.set(match[1], match[2]);
  }
  return tokens;
}

type Pair = {
  name: string;
  fg: string;
  bg: string;
  /** เกณฑ์ขั้นต่ำ — ตัวหนังสือใหญ่และเส้นขอบใช้ 3.0 ที่เหลือใช้ 4.5 */
  min: number;
};

const PAIRS: Pair[] = [
  { name: "ตัวหนังสือหลักบนพื้นหน้า", fg: "ink", bg: "bg", min: 4.5 },
  { name: "ตัวหนังสือหลักบนการ์ด", fg: "ink", bg: "surface", min: 4.5 },
  { name: "ตัวหนังสือรองบนการ์ด", fg: "ink-2", bg: "surface", min: 4.5 },
  { name: "ตัวหนังสือจาง (คำอธิบาย)", fg: "muted", bg: "surface", min: 4.5 },
  { name: "ตัวหนังสือจางบนพื้นหน้า", fg: "muted", bg: "bg", min: 4.5 },
  /**
   * ปุ่มหลักใช้เกณฑ์ 3.0 ได้ เพราะ globals.css บังคับตัวหนังสือบนปุ่มไว้ที่ 19px ตัวหนา
   * ซึ่ง WCAG นับเป็น "ตัวหนังสือขนาดใหญ่" — เป็นทางที่รักษาสีแบรนด์ #EC5F27 ไว้ได้
   */
  { name: "ตัวหนังสือบนปุ่มหลัก (19px ตัวหนา)", fg: "primary-contrast", bg: "primary", min: 3 },
  { name: "ตัวหนังสือบนพื้นสีอ่อนของธีม", fg: "primary-dark", bg: "primary-light", min: 4.5 },
  { name: "ข้อความผิดพลาดบนพื้นเตือน", fg: "danger", bg: "danger-bg", min: 4.5 },
  { name: "ตัวหนังสือบนพื้นรอง", fg: "ink-2", bg: "surface-2", min: 4.5 },
  /**
   * ⚠️ สองคู่นี้เคยหลุดจากการตรวจ แล้ว Lighthouse จับได้ทีหลัง
   *
   *    ข้อความรอง (muted) ถูกใช้บนพื้นหลายสี ไม่ใช่แค่บนการ์ดขาวกับพื้นหน้า
   *    เช่น ป้ายสถานะงานใช้พื้นสีอ่อนของธีม และกล่องข้อมูลใช้พื้นรอง
   *    ตอนนั้นได้ 4.30 กับ 4.23 ซึ่งต่ำกว่าเกณฑ์ 4.5 ทั้งคู่
   *
   *    บทเรียน: ต้องตรวจสีข้อความกับ "ทุกพื้นที่มันไปวางจริง" ไม่ใช่แค่พื้นหลัก
   */
  { name: "ตัวหนังสือจางบนพื้นสีอ่อนของธีม", fg: "muted", bg: "primary-light", min: 4.5 },
  { name: "ตัวหนังสือจางบนพื้นรอง", fg: "muted", bg: "surface-2", min: 4.5 },
  { name: "เส้นขอบเข้มบนการ์ด", fg: "line-strong", bg: "surface", min: 3 },
];

function main() {
  const tokens = readTokens();
  console.log("\n🎨 ตรวจค่าความต่างของสีตามมาตรฐาน WCAG 2.1 ระดับ AA\n");

  let failed = 0;
  let skipped = 0;

  for (const pair of PAIRS) {
    const fgHex = tokens.get(pair.fg);
    const bgHex = tokens.get(pair.bg);
    if (!fgHex || !bgHex) {
      skipped += 1;
      console.log(`⏭️  ${pair.name} — ไม่พบตัวแปรสี (${pair.fg} หรือ ${pair.bg})`);
      continue;
    }

    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if (!fg || !bg) {
      skipped += 1;
      console.log(`⏭️  ${pair.name} — ค่าสีอ่านไม่ออก`);
      continue;
    }

    const ratio = contrast(fg, bg);
    const pass = ratio >= pair.min;
    if (!pass) failed += 1;

    const detail = `${ratio.toFixed(2)} : 1 (ต้องได้ ≥ ${pair.min})  ${fgHex} บน ${bgHex}`;
    console.log(`${pass ? "✅" : "❌"} ${pair.name.padEnd(32)} ${detail}`);
  }

  console.log("");
  if (skipped > 0) console.log(`⏭️  ข้ามไป ${skipped} คู่ เพราะหาตัวแปรสีไม่เจอ`);

  if (failed > 0) {
    console.log(`❌ ไม่ผ่าน ${failed} คู่ — ต้องปรับสีให้ต่างกันมากขึ้นก่อนเปิดใช้งานจริง\n`);
    process.exit(1);
  }
  console.log("✅ ผ่านทุกคู่ตามเกณฑ์ AA\n");
}

main();
