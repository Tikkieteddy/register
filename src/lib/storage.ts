/**
 * ชั้นเก็บไฟล์ — ออกแบบให้สลับผู้ให้บริการได้โดยแก้ไฟล์เดียว
 *
 * สรุปการตัดสินใจในเฟส 5: ฐานข้อมูลอยู่กับ Supabase (ต้องใช้ row lock ตัดโควตา)
 * ส่วนไฟล์ภาพเก็บบน Cloudflare R2 เพราะค่า egress ฟรีและมีจุดกระจายข้อมูลในกรุงเทพฯ
 * ตอนพัฒนาในเครื่องจะเขียนลงโฟลเดอร์ public/uploads แทนโดยอัตโนมัติ
 *
 * โค้ดส่วนอื่นของระบบเรียกผ่าน interface นี้เท่านั้น
 * ห้ามเรียก SDK ของผู้ให้บริการโดยตรงจากที่อื่น
 */

import { LocalDiskStorage } from "./storage/local";
import { R2Storage } from "./storage/r2";

export type StorageObject = {
  key: string;
  url: string;
  sizeBytes: number;
  contentType: string;
};

export interface StorageAdapter {
  readonly name: string;
  upload(params: {
    key: string;
    body: Uint8Array | ArrayBuffer;
    contentType: string;
  }): Promise<StorageObject>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
}

/**
 * ตัวเก็บไฟล์สำรองเมื่อยังตั้งค่าไม่ครบ
 *
 * ใช้เมื่อรันบนเครื่องจริงแต่ยังไม่ได้ใส่ค่าของ R2
 * ล้มพร้อมข้อความที่บอกชัดว่าต้องตั้งค่าตัวไหน ดีกว่าปล่อยให้อัปโหลดสำเร็จ
 * แล้วไฟล์หายไปเงียบ ๆ ตอน deploy ครั้งถัดไป
 */
class NotConfiguredStorage implements StorageAdapter {
  readonly name = "not-configured";

  private fail(): never {
    /**
     * บอกชื่อตัวแปรที่ขาดไปตรง ๆ ไม่ใช่ลิสต์ทั้ง 5 ตัวให้ไปไล่เดาเอง
     *
     * ⚠️ บอกแค่ "ชื่อ" ห้ามบอก "ค่า" เด็ดขาด ข้อความนี้ขึ้นบนหน้าจอผู้ใช้
     *    และสองในห้าตัวเป็นกุญแจลับที่ใครได้ไปลบไฟล์ทั้งถังได้
     */
    const missing = missingStorageKeys();
    throw new Error(
      missing.length > 0
        ? `ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — ขาดตัวแปร ${missing.join(", ")} ` +
            "ให้ไปตั้งค่าบน Vercel แล้วสั่ง Redeploy ก่อนจึงจะอัปโหลดภาพได้"
        : "ตั้งค่าที่เก็บไฟล์ครบแล้วแต่ยังใช้ไม่ได้ — ตรวจว่าค่าถูกต้องและสั่ง Redeploy แล้วหรือยัง",
    );
  }

  async upload(): Promise<StorageObject> {
    this.fail();
  }

  getPublicUrl(key: string): string {
    // คืน path ของไฟล์ใน public/ ไปก่อน เพื่อให้หน้าเว็บที่ใช้ภาพ placeholder ทำงานได้
    return key.startsWith("/") ? key : `/${key}`;
  }

  async delete(): Promise<void> {
    this.fail();
  }
}

/**
 * เลือกที่เก็บไฟล์ตามค่าที่ตั้งไว้
 *
 * ① ถ้าตั้งค่า R2 ครบ → ใช้ Cloudflare R2 (ที่ตกลงกันไว้สำหรับเครื่องจริง)
 * ② ถ้าไม่ครบ แต่อยู่ในโหมดพัฒนา → เขียนลงโฟลเดอร์ public/uploads
 * ③ ถ้าไม่ครบ และอยู่บนเครื่องจริง → ล้มพร้อมบอกว่าขาดค่าตัวไหน
 */
function createDefaultAdapter(): StorageAdapter {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (accountId && bucket && accessKeyId && secretAccessKey && publicBaseUrl) {
    return new R2Storage({ accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl });
  }

  if (process.env.NODE_ENV !== "production") return new LocalDiskStorage();

  return new NotConfiguredStorage();
}

let adapter: StorageAdapter | null = null;

/** เปลี่ยนผู้ให้บริการที่เก็บไฟล์ — ใช้ตอนเขียนชุดทดสอบ */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

export function getStorage(): StorageAdapter {
  adapter ??= createDefaultAdapter();
  return adapter;
}

/**
 * ที่เก็บไฟล์พร้อมใช้งานจริงหรือยัง
 *
 * ใช้ในหน้าตรวจสุขภาพระบบ เพื่อให้ผู้จัดงานรู้ตัวก่อนวันงานว่ายังตั้งค่าไม่ครบ
 * แทนที่จะไปรู้เอาตอนกดอัปโหลดโปสเตอร์แล้วไม่สำเร็จ
 */
export function isStorageConfigured(): boolean {
  return getStorage().name !== "not-configured";
}

/** ชื่อตัวแปรทั้งหมดที่ต้องตั้งให้ครบก่อนอัปโหลดไฟล์บนเครื่องจริงได้ */
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
] as const;

/**
 * บอกว่ายังขาดตัวแปรตัวไหนบ้าง
 *
 * ⚠️ มีไว้เพราะการบอกแค่ "ยังตั้งค่าไม่ครบ" ทำให้คนตั้งค่าต้องไล่เดาเองทั้ง 5 ตัว
 *    ว่าพิมพ์ชื่อผิดตัวไหน หรือลืมตัวไหน ซึ่งเสียเวลาและหาไม่เจอจริง ๆ
 *
 * ⚠️ คืนแค่ "ชื่อ" ของตัวแปรที่ขาด ห้ามคืนค่าข้างในเด็ดขาด
 *    เพราะสองในห้าตัวเป็นกุญแจลับ ถ้าหลุดออกไปคนอื่นลบไฟล์ทั้งถังได้
 *
 * นับค่าที่เป็นช่องว่างล้วนว่า "ขาด" ด้วย เพราะเคยเจอมาแล้วว่าคัดลอกมาแล้ว
 * ติดช่องว่างหรือบรรทัดใหม่มาด้วยจนใช้งานไม่ได้
 */
export function missingStorageKeys(): string[] {
  return R2_KEYS.filter((key) => !(process.env[key] ?? "").trim());
}
