/**
 * ทดสอบโหลด — จำลองคน 300 คนแย่งกดจองที่นั่งพร้อมกัน (ข้อกำหนด E1)
 *
 * รันด้วย:
 *   k6 run -e SESSION_ID=<id ของช่วงเวลา> tests/load/hold-seat.js
 *
 * ทำไมต้องทดสอบตรงนี้ ไม่ใช่หน้าแรก:
 *   การกดจองที่นั่งคือจุดเดียวในระบบที่คนหลายร้อยคนแตะข้อมูลก้อนเดียวกัน
 *   พร้อมกัน (ตัวนับที่นั่งของช่วงเวลานั้น) ถ้าตรงนี้พลาด ระบบจะรับคนเกินโควตา
 *   ส่วนหน้าอื่นเป็นการอ่านอย่างเดียว ซึ่งไม่มีความเสี่ยงแบบเดียวกัน
 *
 * ⚠️ แต่ละคนต้องใช้ที่อยู่เครือข่ายต่างกัน เพราะระบบมีด่านจำกัดจำนวนครั้งต่อ IP
 *    ถ้ายิงจาก IP เดียวทั้งหมด จะถูกบล็อกตั้งแต่คนที่ 61 ซึ่งเป็นการทำงานที่ถูกต้อง
 *    แต่ไม่ใช่สิ่งที่เราต้องการวัดในเทสต์นี้
 */
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:3100";
const SESSION_ID = __ENV.SESSION_ID;
const ACTION_ID = __ENV.ACTION_ID;
const EVENT_SLUG = __ENV.EVENT_SLUG || "tnn-event-2026";

const held = new Counter("seats_held");            // จองที่นั่งสำเร็จ
const soldOut = new Counter("sold_out");            // ที่นั่งเต็มแล้ว
const rateLimited = new Counter("rate_limited");    // ถูกจำกัดจำนวนครั้ง
const serverError = new Counter("server_errors");   // เซิร์ฟเวอร์ผิดพลาด

export const options = {
  scenarios: {
    // คน 300 คนกดพร้อมกันภายใน 10 วินาที — เหมือนนาทีแรกที่เปิดรับลงทะเบียน
    spike: { executor: "per-vu-iterations", vus: 300, iterations: 1, maxDuration: "60s" },
  },
  thresholds: {
    // ข้อกำหนด E1: ต้องไม่มีคำขอไหนล้มด้วยความผิดพลาดของเซิร์ฟเวอร์เลย
    server_errors: ["count==0"],
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<3000"],
  },
};

// k6 กำหนดให้ฟังก์ชันที่แต่ละคนรันต้องเป็น default export — ตั้งชื่อไว้ให้อ่านง่าย
export default function holdSeatOnce() {
  const res = http.post(`${BASE}/e/${EVENT_SLUG}/register`, JSON.stringify([EVENT_SLUG, SESSION_ID]), {
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      "next-action": ACTION_ID,
      // แต่ละคนมาจากที่อยู่ต่างกัน เหมือนคนจริงที่ใช้เน็ตมือถือคนละเครื่อง
      "x-real-ip": `10.${__VU % 200}.${Math.floor(__VU / 200)}.${(__VU % 250) + 1}`,
    },
  });

  const body = res.body || "";
  if (res.status >= 500) serverError.add(1);
  else if (body.includes("holdToken")) held.add(1);
  else if (body.includes("เต็มแล้ว")) soldOut.add(1);
  else if (body.includes("ถี่เกินไป")) rateLimited.add(1);

  check(res, { "ไม่ใช่ความผิดพลาดของเซิร์ฟเวอร์": (r) => r.status < 500 });
}
