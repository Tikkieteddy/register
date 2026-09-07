import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StorageAdapter, StorageObject } from "@/lib/storage";

/**
 * เก็บไฟล์ลงดิสก์ในโฟลเดอร์ public/uploads
 *
 * ⚠️ ใช้ได้เฉพาะตอนพัฒนาในเครื่องเท่านั้น
 *    Vercel มีระบบไฟล์แบบอ่านอย่างเดียว ไฟล์ที่เขียนไว้จะหายทุกครั้งที่ deploy
 *    บนเครื่องจริงต้องใช้ R2Storage เสมอ
 */
const ROOT = join(process.cwd(), "public", "uploads");

export class LocalDiskStorage implements StorageAdapter {
  readonly name = "local-disk";

  async upload(params: {
    key: string;
    body: Uint8Array | ArrayBuffer;
    contentType: string;
  }): Promise<StorageObject> {
    const target = join(ROOT, params.key);
    await mkdir(dirname(target), { recursive: true });
    const bytes =
      params.body instanceof Uint8Array ? params.body : new Uint8Array(params.body);
    await writeFile(target, bytes);
    return {
      key: params.key,
      url: this.getPublicUrl(params.key),
      sizeBytes: bytes.byteLength,
      contentType: params.contentType,
    };
  }

  getPublicUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(ROOT, key));
    } catch {
      // ไฟล์หายไปแล้วถือว่าลบสำเร็จ ไม่ต้องทำให้การลบทั้งชุดล้ม
    }
  }
}
