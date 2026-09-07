import { createHash, createHmac } from "node:crypto";
import type { StorageAdapter, StorageObject } from "@/lib/storage";

/**
 * เก็บไฟล์บน Cloudflare R2
 *
 * R2 ใช้ API แบบเดียวกับ Amazon S3 จึงต้องเซ็นคำขอด้วย AWS Signature V4
 * เขียนการเซ็นเองด้วย crypto ที่ Node มีอยู่แล้ว แทนการติดตั้ง AWS SDK
 * ซึ่งมีขนาดหลายสิบเมกะไบต์และมี dependency จำนวนมาก
 *
 * เหตุผลที่เลือก R2: ค่า egress ฟรี (ภาพโปสเตอร์ถูกโหลดซ้ำมากตอนโปรโมท)
 * และมีจุดกระจายข้อมูลในกรุงเทพฯ ทำให้ภาพขึ้นเร็วสำหรับผู้ใช้ไทย
 */
const SERVICE = "s3";
const REGION = "auto";

export type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** โดเมนสาธารณะที่ผูกกับ bucket เช่น https://img.tnn.co.th */
  publicBaseUrl: string;
};

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export class R2Storage implements StorageAdapter {
  readonly name = "cloudflare-r2";

  constructor(private readonly config: R2Config) {}

  private get host(): string {
    return `${this.config.accountId}.r2.cloudflarestorage.com`;
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = hmac(`AWS4${this.config.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, REGION);
    const kService = hmac(kRegion, SERVICE);
    return hmac(kService, "aws4_request");
  }

  async upload(params: {
    key: string;
    body: Uint8Array | ArrayBuffer;
    contentType: string;
  }): Promise<StorageObject> {
    const bytes = params.body instanceof Uint8Array ? params.body : new Uint8Array(params.body);
    const payloadHash = sha256Hex(bytes);
    // คัดลอกลง ArrayBuffer ของตัวเอง เพื่อให้ตรงกับชนิด BodyInit ที่ fetch รับ
    const payload = bytes.slice().buffer as ArrayBuffer;

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    // แต่ละส่วนของ path ต้อง encode แยกกัน ไม่งั้นเครื่องหมาย / จะถูกแปลงไปด้วย
    const canonicalUri = `/${this.config.bucket}/${params.key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const canonicalHeaders =
      `content-type:${params.contentType}\n` +
      `host:${this.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = [
      "PUT",
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signature = hmac(this.signingKey(dateStamp), stringToSign).toString("hex");

    const response = await fetch(`https://${this.host}${canonicalUri}`, {
      method: "PUT",
      headers: {
        "Content-Type": params.contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: payload,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`อัปโหลดไฟล์ขึ้น R2 ไม่สำเร็จ (${response.status}) ${detail.slice(0, 200)}`);
    }

    return {
      key: params.key,
      url: this.getPublicUrl(params.key),
      sizeBytes: bytes.byteLength,
      contentType: params.contentType,
    };
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const emptyHash = sha256Hex("");
    const canonicalUri = `/${this.config.bucket}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const canonicalHeaders =
      `host:${this.host}\n` +
      `x-amz-content-sha256:${emptyHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = [
      "DELETE",
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      emptyHash,
    ].join("\n");

    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const signature = hmac(this.signingKey(dateStamp), stringToSign).toString("hex");

    await fetch(`https://${this.host}${canonicalUri}`, {
      method: "DELETE",
      headers: {
        "x-amz-content-sha256": emptyHash,
        "x-amz-date": amzDate,
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    });
  }
}
