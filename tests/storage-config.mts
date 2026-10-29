/**
 * ทดสอบว่าระบบบอกได้ถูกต้องว่าตั้งค่าที่เก็บไฟล์ขาดตัวแปรตัวไหน
 *
 * รันด้วย:
 *   npx tsx tests/storage-config.mts
 *
 * ⚠️ ทำไมต้องมีเทสต์นี้
 *
 *    เดิมพอตั้งค่าไม่ครบ ระบบบอกแค่ "ยังไม่ได้ตั้งค่า" แล้วลิสต์ชื่อตัวแปรทั้ง 5 ตัว
 *    คนตั้งค่าจึงต้องไล่เดาเองว่าลืมตัวไหน หรือพิมพ์ชื่อผิดตัวไหน
 *    ซึ่งเกิดขึ้นจริงแล้วตอนตั้งค่า Cloudflare R2 ครั้งแรก — เสียเวลาหลายรอบ
 *
 * ⚠️ ข้อที่สำคัญที่สุดในไฟล์นี้คือข้อสุดท้าย — ต้องไม่หลุดค่าของกุญแจลับ
 *    ข้อความนี้ขึ้นบนหน้าจอผู้ใช้ ถ้าเผลอใส่ค่าลงไปด้วยจะกลายเป็นช่องโหว่ทันที
 */
import { missingStorageKeys } from "@/lib/storage";

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

const ALL = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
];

const SECRET_VALUE = "ค่าลับห้ามหลุด-abc123";

/** ตั้งค่าตัวแปรทั้ง 5 ตามที่สั่ง แล้วคืนค่าเดิมกลับหลังตรวจเสร็จ */
function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const before: Record<string, string | undefined> = {};
  for (const key of ALL) {
    before[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    run();
  } finally {
    for (const key of ALL) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

console.log("\n① บอกได้ว่าขาดตัวไหน");

withEnv({}, () => {
  check("ไม่ได้ตั้งเลยสักตัว — บอกครบทั้ง 5", missingStorageKeys().length === 5);
});

const full = Object.fromEntries(ALL.map((k) => [k, "x"]));

withEnv({ ...full, R2_SECRET_ACCESS_KEY: undefined }, () => {
  const missing = missingStorageKeys();
  check(
    "ลืมตัวเดียว — บอกชื่อตัวนั้นตัวเดียว",
    missing.length === 1 && missing[0] === "R2_SECRET_ACCESS_KEY",
    `ได้ ${missing.join(", ") || "ไม่มี"}`,
  );
});

withEnv({ ...full, R2_BUCKET: undefined, R2_PUBLIC_BASE_URL: undefined }, () => {
  const missing = missingStorageKeys();
  check(
    "ลืมสองตัว — บอกครบทั้งสอง ไม่เกินไม่ขาด",
    missing.length === 2 &&
      missing.includes("R2_BUCKET") &&
      missing.includes("R2_PUBLIC_BASE_URL"),
    `ได้ ${missing.join(", ")}`,
  );
});

withEnv(full, () => {
  check("ตั้งครบแล้ว — ไม่บอกว่าขาดอะไร", missingStorageKeys().length === 0);
});

console.log("\n② ค่าที่คัดลอกมาแล้วติดช่องว่าง");

/**
 * เคยเกิดขึ้นจริงแล้วกับ CRON_SECRET — คัดลอกมาแล้วติดตัวขึ้นบรรทัดใหม่
 * จน Vercel สร้างเว็บไม่สำเร็จ ค่าแบบนี้ต้องถือว่า "ขาด" ไม่ใช่ "มีแล้ว"
 */
withEnv({ ...full, R2_ACCOUNT_ID: "   " }, () => {
  check(
    "ค่าเป็นช่องว่างล้วน นับว่าขาด",
    missingStorageKeys().includes("R2_ACCOUNT_ID"),
  );
});

withEnv({ ...full, R2_BUCKET: "\n" }, () => {
  check(
    "ค่าเป็นตัวขึ้นบรรทัดใหม่ นับว่าขาด",
    missingStorageKeys().includes("R2_BUCKET"),
  );
});

console.log("\n③ ต้องไม่หลุดค่าของกุญแจลับ");

withEnv({ ...full, R2_SECRET_ACCESS_KEY: SECRET_VALUE, R2_BUCKET: undefined }, () => {
  const text = missingStorageKeys().join(" ");
  check(
    "รายชื่อที่ขาดไม่มีค่าของกุญแจลับปนมา",
    !text.includes(SECRET_VALUE),
    text,
  );
  check("บอกแต่ชื่อตัวแปร ไม่มีค่าใด ๆ ปนมา", !text.includes("x"), text);
});

console.log(`\nผ่าน ${passed} ข้อ · ไม่ผ่าน ${failed} ข้อ`);
console.log(failed === 0 ? "✅ ผ่านทั้งหมด" : "❌ ยังไม่ผ่าน");
process.exit(failed === 0 ? 0 : 1);
