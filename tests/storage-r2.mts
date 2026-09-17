/**
 * ทดสอบการเซ็นคำขอไปยัง Cloudflare R2
 *
 * รันด้วย:
 *   npx tsx tests/storage-r2.ts
 *
 * ⚠️ ทำไมต้องมีเทสต์นี้
 *
 *    โค้ดคุยกับ R2 เขียนการเซ็นลายเซ็นแบบ AWS Signature V4 เองด้วยมือ
 *    (เพื่อเลี่ยงการติดตั้ง AWS SDK ที่ใหญ่หลายสิบเมกะไบต์)
 *    แต่ไม่เคยถูกรันเลยสักครั้ง เพราะยังไม่ได้ตั้งค่า R2
 *
 *    ถ้าการเซ็นผิดแม้แต่นิดเดียว R2 จะตอบ 403 ทุกครั้งโดยไม่บอกว่าผิดตรงไหน
 *    ซึ่งจะไปรู้เอาตอนกดอัปโหลดโปสเตอร์ก่อนวันงาน — สายเกินไป
 *
 * เทสต์นี้ไม่ต่ออินเทอร์เน็ตจริง ใช้การดักคำขอแทน จึงรันได้ทุกที่
 */
import { deriveSigningKey, R2Storage } from "@/lib/storage/r2";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

/* ---------- ① เทียบกับค่าตัวอย่างที่ AWS ประกาศไว้ ---------- */
console.log("\n① ขั้นตอนสร้างกุญแจเซ็น (เทียบค่าตัวอย่างของ AWS)");

/**
 * ค่าชุดนี้ AWS ประกาศไว้ในเอกสารเรื่องการสร้างกุญแจเซ็นของ Signature V4
 * เป็นค่าคงที่ที่ทุกไลบรารีในโลกต้องคำนวณได้ตรงกัน จึงใช้เป็นหลักฐานได้ว่า
 * โค้ดของเราคำนวณถูกต้องจริง ไม่ใช่แค่ "ดูเหมือนถูก"
 */
const AWS_EXAMPLE = {
  secret: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  dateStamp: "20120215",
  region: "us-east-1",
  service: "iam",
  expectedHex: "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
};

const derived = deriveSigningKey(
  AWS_EXAMPLE.secret,
  AWS_EXAMPLE.dateStamp,
  AWS_EXAMPLE.region,
  AWS_EXAMPLE.service,
).toString("hex");

check(
  "คำนวณกุญแจได้ตรงกับค่าตัวอย่างของ AWS",
  derived === AWS_EXAMPLE.expectedHex,
  `ได้ ${derived}`,
);

/* ---------- ② รูปร่างของคำขอที่ส่งไป R2 ---------- */
console.log("\n② คำขอที่ส่งไป R2");

const CONFIG = {
  accountId: "acct123",
  bucket: "tnn-media",
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret-example",
  publicBaseUrl: "https://pub-example.r2.dev/",
};

type Captured = { url: string; init: RequestInit };
let captured: Captured | null = null;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  captured = { url: String(url), init: init ?? {} };
  return new Response("", { status: 200 });
}) as typeof fetch;

const storage = new R2Storage(CONFIG);
const body = new TextEncoder().encode("ภาพทดสอบ");

const result = await storage.upload({
  // ตั้งใจใส่ path ซ้อนชั้นและอักขระที่ต้อง encode เพื่อตรวจว่าแปลงถูก
  key: "events/tnn 2026/โปสเตอร์.png",
  body,
  contentType: "image/png",
});

globalThis.fetch = realFetch;

const cap = captured as Captured | null;
if (!cap) {
  check("ยิงคำขอออกไปจริง", false, "ไม่พบคำขอเลย");
} else {
  const headers = (cap.init.headers ?? {}) as Record<string, string>;
  const auth = headers.Authorization ?? "";

  check("ส่งด้วยวิธี PUT", cap.init.method === "PUT");

  check(
    "ยิงไปที่โดเมนของบัญชี R2 ที่ถูกต้อง",
    cap.url.startsWith(`https://${CONFIG.accountId}.r2.cloudflarestorage.com/`),
    cap.url,
  );

  /**
   * เครื่องหมาย / ที่คั่นโฟลเดอร์ต้องคงอยู่ ส่วนช่องว่างและภาษาไทยต้องถูกแปลง
   * ถ้าแปลง / ไปด้วย ไฟล์จะไปกองรวมกันในชั้นเดียวแทนที่จะแยกโฟลเดอร์
   */
  check(
    "คงเครื่องหมายแบ่งโฟลเดอร์ไว้ ไม่แปลงทิ้ง",
    cap.url.includes("/tnn-media/events/") && !cap.url.includes("events%2F"),
    cap.url,
  );
  check(
    "แปลงช่องว่างและภาษาไทยในชื่อไฟล์แล้ว",
    !cap.url.includes(" ") && cap.url.includes("%"),
    cap.url,
  );

  check("ใส่หัวข้อ Authorization แบบ AWS4-HMAC-SHA256", auth.startsWith("AWS4-HMAC-SHA256 "));
  check("ระบุคีย์และขอบเขตครบ", auth.includes(`Credential=${CONFIG.accessKeyId}/`));
  check("ขอบเขตลงท้ายด้วย auto/s3/aws4_request", auth.includes("/auto/s3/aws4_request"));

  /**
   * ⚠️ หัวข้อทุกตัวที่ประกาศใน SignedHeaders ต้องถูกส่งไปจริงครบทุกตัว
   *    ถ้าประกาศไว้แต่ไม่ส่ง หรือส่งแต่ไม่ประกาศ ลายเซ็นจะไม่ตรงและได้ 403
   */
  const declared = auth.match(/SignedHeaders=([^,]+)/)?.[1]?.split(";") ?? [];
  const sentKeys = Object.keys(headers).map((h) => h.toLowerCase());
  const missing = declared.filter((h) => h !== "host" && !sentKeys.includes(h));
  check(
    "ส่งหัวข้อครบทุกตัวที่ประกาศว่าเซ็นไว้",
    declared.length > 0 && missing.length === 0,
    `ประกาศ ${declared.join(",")} · ขาด ${missing.join(",") || "ไม่ขาด"}`,
  );

  check("มีลายเซ็นแนบมาด้วย", /Signature=[0-9a-f]{64}$/.test(auth), auth.slice(-80));
}

/* ---------- ③ ที่อยู่สาธารณะของไฟล์ ---------- */
console.log("\n③ ที่อยู่ที่เอาไปแสดงบนหน้าเว็บ");

check(
  "ตัดเครื่องหมาย / ท้ายโดเมนไม่ให้ซ้อนกัน",
  result.url === "https://pub-example.r2.dev/events/tnn 2026/โปสเตอร์.png",
  result.url,
);
check("บันทึกขนาดไฟล์ถูกต้อง", result.sizeBytes === body.byteLength);
check("บันทึกชนิดไฟล์ถูกต้อง", result.contentType === "image/png");

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
