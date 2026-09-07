import { existsSync } from "node:fs";
import { chromium } from "playwright";

/**
 * เปิดเบราว์เซอร์สำหรับชุดทดสอบ
 *
 * ปกติ Playwright จะหาเบราว์เซอร์ที่ตัวเองดาวน์โหลดไว้เอง (npx playwright install)
 * แต่บางเครื่อง เช่น container ของ CI มีเบราว์เซอร์ติดตั้งไว้ให้แล้วที่ path คงที่
 * และดาวน์โหลดเพิ่มไม่ได้ — ตัวช่วยนี้จึงเลือกให้อัตโนมัติ
 *
 * กำหนดเองได้ด้วยตัวแปรแวดล้อม CHROMIUM_PATH
 */
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium",
].filter((path) => typeof path === "string" && path.length > 0);

export function launchBrowser(options = {}) {
  const executablePath = CANDIDATES.find((path) => existsSync(path));
  return chromium.launch(executablePath ? { ...options, executablePath } : options);
}
