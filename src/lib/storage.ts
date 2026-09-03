/**
 * ชั้นเก็บไฟล์ — ออกแบบให้สลับผู้ให้บริการได้โดยแก้ไฟล์เดียว
 *
 * ตามที่คุยกันไว้: ฐานข้อมูลอยู่กับ Supabase (ต้องใช้ row lock ตัดโควตา)
 * ส่วนไฟล์ภาพเอนไปทาง Cloudflare R2 เพราะ egress ฟรีและมี PoP กรุงเทพฯ
 * แต่ยังไม่ต้องตัดสินใจตอนนี้ — ตัดสินใจจริงตอนเฟส 5 (Media Manager)
 *
 * โค้ดส่วนอื่นของระบบเรียกผ่าน interface นี้เท่านั้น
 * ห้ามเรียก SDK ของผู้ให้บริการโดยตรงจากที่อื่น
 */

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
 * ตัวเก็บไฟล์ชั่วคราวสำหรับเฟส 2
 *
 * เฟส 2 ยังไม่มีการอัปโหลดไฟล์จริง (Media Manager อยู่ในเฟส 5)
 * ตัวนี้ทำหน้าที่แค่ประกาศ interface ให้โค้ดส่วนอื่นเรียกได้อย่างปลอดภัย
 * และล้มพร้อมข้อความที่ชัดเจนถ้ามีใครเผลอเรียกใช้ก่อนถึงเวลา
 */
class NotConfiguredStorage implements StorageAdapter {
  readonly name = "not-configured";

  private fail(): never {
    throw new Error(
      "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — จะติดตั้งจริงในเฟส 5 (Media Manager) " +
        "โดยเลือกระหว่าง Cloudflare R2 กับ Supabase Storage",
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

let adapter: StorageAdapter = new NotConfiguredStorage();

/** เปลี่ยนผู้ให้บริการที่เก็บไฟล์ — จะเรียกใช้ตอนเฟส 5 */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

export function getStorage(): StorageAdapter {
  return adapter;
}
