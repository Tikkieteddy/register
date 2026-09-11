/**
 * หารหัสของคำสั่งจองที่นั่ง โดยเปิดหน้าฟอร์มจริงแล้วดักดูว่าเบราว์เซอร์ส่งอะไร
 *
 * รหัสนี้เปลี่ยนทุกครั้งที่ build ใหม่ จึงอ่านจากไฟล์ที่เขียนไว้ล่วงหน้าไม่ได้
 * ต้องดักจากของจริงเท่านั้น พิมพ์รหัสออกมาทาง stdout ให้สคริปต์อื่นเอาไปใช้ต่อ
 */
import { launchBrowser } from "../tests/browser.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SLUG = process.env.EVENT_SLUG ?? "tnn-event-2026";

const b = await launchBrowser();
const p = await (await b.newContext()).newPage();

let actionId = null;
p.on("request", (r) => {
  const id = r.headers()["next-action"];
  if (r.method() === "POST" && id) actionId = id;
});

await p.goto(`${BASE}/e/${SLUG}/register`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.locator('input[type="checkbox"][name^="sessionIds-"]').first().click();
await p.waitForTimeout(3000);
await b.close();

if (!actionId) {
  console.error("ไม่พบคำสั่งจองที่นั่ง — เซิร์ฟเวอร์เปิดอยู่หรือไม่");
  process.exit(1);
}
process.stdout.write(actionId);
