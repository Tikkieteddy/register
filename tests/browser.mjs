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

/**
 * กุญแจที่ระบบใช้จำว่าเคยดูคำแนะนำการใช้งานแล้ว
 * ต้องตรงกับที่ใช้จริงในหน้าเว็บ (ดู src/components/tour/*)
 */
const TOUR_KEYS = ["tour.public.v1", "tour.cms.v1", "tour.scan.v1"];

/**
 * เปิดเบราว์เซอร์สำหรับชุดทดสอบ
 *
 * ⚠️ ค่าเริ่มต้นจะ "ปิดคำแนะนำการใช้งาน" ให้ทุกหน้าต่างที่เปิดใหม่
 *
 *    คำแนะนำสำหรับคนเข้าครั้งแรกจะขึ้นคลุมทั้งจอ ซึ่งถูกต้องสำหรับคนใช้จริง
 *    แต่ทำให้เทสต์อื่นกดปุ่มไม่ได้เพราะโดนฉากมืดบังไว้ — เทสต์จะล้มแบบสับสน
 *    โดยที่ระบบทำงานถูกต้องทุกอย่าง
 *
 *    เทสต์ที่ต้องการทดสอบตัวคำแนะนำเอง ให้ส่ง { keepTour: true } มา
 */
export function launchBrowser(options = {}) {
  const { keepTour = false, ...launchOptions } = options;
  const executablePath = CANDIDATES.find((path) => existsSync(path));
  const promise = chromium.launch(
    executablePath ? { ...launchOptions, executablePath } : launchOptions,
  );

  if (keepTour) return promise;

  return promise.then((browser) => {
    const original = browser.newContext.bind(browser);
    browser.newContext = async (contextOptions) => {
      const ctx = await original(contextOptions);
      // ตั้งค่าก่อนหน้าเว็บเริ่มทำงาน เพื่อให้คำแนะนำไม่ทันขึ้นมาบัง
      await ctx.addInitScript((keys) => {
        try {
          for (const key of keys) localStorage.setItem(key, "done");
        } catch {
          // เบราว์เซอร์ปิดการเก็บข้อมูล — ไม่เป็นไร เทสต์ที่กระทบมีไม่กี่ตัว
        }
      }, TOUR_KEYS);
      return ctx;
    };
    return browser;
  });
}
