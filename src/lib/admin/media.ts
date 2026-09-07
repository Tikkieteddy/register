import sharp from "sharp";
import type { MediaType } from "@/lib/admin/media-types";
import { getStorage } from "@/lib/storage";

/**
 * ประมวลผลภาพที่อัปโหลด (หัวข้อ 8.4)
 *
 * ทำ 3 อย่างให้อัตโนมัติ เพราะเป็นงานที่คนมักลืมทำ แล้วเว็บช้าโดยไม่รู้ตัว:
 * ① บีบอัดและแปลงเป็น WebP กับ AVIF — โปสเตอร์ต้องไม่เกิน ~200 KB ตามข้อกำหนด E3
 * ② สร้างหลายขนาดสำหรับ srcset — มือถือจะได้ไม่ต้องโหลดภาพ 1200px
 * ③ อ่านความกว้าง-สูงจริงมาเก็บไว้ เพื่อกันหน้าเว็บกระตุกตอนภาพโหลดเสร็จ
 *
 * ⚠️ ความปลอดภัย: ต้องให้ sharp อ่านและเขียนภาพใหม่ทุกครั้ง
 *    ไฟล์ที่ผ่านการเขียนใหม่จะไม่เหลือสคริปต์หรือ metadata ที่ฝังมา
 */

/** ขนาดที่สร้างให้สำหรับ srcset — ตัดตัวที่ใหญ่กว่าภาพต้นฉบับออกเสมอ */
const VARIANT_WIDTHS = [400, 800, 1200] as const;

export type ProcessedImage = {
  originalUrl: string;
  webpUrl: string | null;
  avifUrl: string | null;
  variants: { w: number; url: string }[];
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  warnings: string[];
};

/** ขนาดที่แนะนำของภาพแต่ละประเภท ใช้เตือนเมื่ออัปโหลดผิดสัดส่วน */
export const RECOMMENDED: Record<MediaType, { w?: number; h?: number; note: string }> = {
  logo: { note: "SVG หรือ PNG พื้นโปร่งใส สูงอย่างน้อย 200px" },
  poster: { w: 1200, h: 1200, note: "1200×1200 px" },
  banner: { w: 1920, h: 640, note: "1920×640 px" },
  speaker: { w: 400, h: 400, note: "400×400 px จัตุรัส" },
  sponsor: { note: "PNG พื้นโปร่งใส" },
  badge_background: { note: "ตามขนาดบัตรจริงที่ 300 DPI" },
  gallery: { w: 800, h: 600, note: "800×600 px" },
  og_image: { w: 1200, h: 630, note: "1200×630 px — ขนาดที่ Facebook และ LINE ใช้" },
};

/** ขนาดไฟล์สูงสุดที่รับ — ใหญ่กว่านี้มักเป็นภาพที่ยังไม่ได้ย่อจากกล้อง */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

function keyFor(eventId: string, type: MediaType, name: string): string {
  const stamp = Date.now().toString(36);
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `events/${eventId}/${type}/${stamp}-${safe || "image"}`;
}

export async function processAndUpload(params: {
  eventId: string;
  type: MediaType;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ProcessedImage> {
  const storage = getStorage();
  const warnings: string[] = [];
  const baseKey = keyFor(params.eventId, params.type, params.fileName);

  /**
   * SVG ไม่ต้องแปลงหรือย่อ เพราะขยายเท่าไรก็คมอยู่แล้ว
   * แต่ต้องไม่ปล่อยผ่านดื้อ ๆ เพราะ SVG ฝัง <script> ได้
   * จึงตัดแท็กที่ทำงานได้ออกก่อนเก็บ
   */
  if (params.mimeType === "image/svg+xml") {
    const source = Buffer.from(params.bytes).toString("utf8");
    const cleaned = source
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
      .replace(/javascript:/gi, "");

    if (cleaned !== source) {
      warnings.push("พบสคริปต์ฝังอยู่ในไฟล์ SVG และถูกลบออกแล้วเพื่อความปลอดภัย");
    }

    const cleanedBytes = new TextEncoder().encode(cleaned);
    const uploaded = await storage.upload({
      key: `${baseKey}.svg`,
      body: cleanedBytes,
      contentType: "image/svg+xml",
    });

    return {
      originalUrl: uploaded.url,
      webpUrl: null,
      avifUrl: null,
      variants: [],
      width: 0,
      height: 0,
      sizeBytes: uploaded.sizeBytes,
      mimeType: "image/svg+xml",
      warnings,
    };
  }

  const image = sharp(params.bytes, { failOn: "error" });
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const recommended = RECOMMENDED[params.type];
  if (recommended.w && recommended.h && width > 0 && height > 0) {
    const wanted = recommended.w / recommended.h;
    const actual = width / height;
    // ยอมให้ต่างได้ 10% เพราะการครอปด้วยมือมักไม่ตรงเป๊ะ
    if (Math.abs(actual - wanted) / wanted > 0.1) {
      warnings.push(
        `สัดส่วนภาพไม่ตรงกับที่แนะนำ — ภาพนี้ ${width}×${height} px แต่ควรเป็น ${recommended.note}`,
      );
    }
    if (width < recommended.w) {
      warnings.push(`ภาพเล็กกว่าที่แนะนำ อาจเบลอเมื่อแสดงเต็มจอ (ควรกว้างอย่างน้อย ${recommended.w} px)`);
    }
  }

  // เขียนภาพต้นฉบับใหม่เป็น JPEG/PNG ที่บีบอัดแล้ว ไม่เก็บไฟล์ที่ผู้ใช้ส่งมาตรง ๆ
  const isPng = params.mimeType === "image/png";
  const originalBuffer = isPng
    ? await image.clone().png({ compressionLevel: 9, palette: true }).toBuffer()
    : await image.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();

  const [webpBuffer, avifBuffer] = await Promise.all([
    image.clone().webp({ quality: 80 }).toBuffer(),
    image.clone().avif({ quality: 58 }).toBuffer(),
  ]);

  const [original, webp, avif] = await Promise.all([
    storage.upload({
      key: `${baseKey}.${isPng ? "png" : "jpg"}`,
      body: new Uint8Array(originalBuffer),
      contentType: isPng ? "image/png" : "image/jpeg",
    }),
    storage.upload({
      key: `${baseKey}.webp`,
      body: new Uint8Array(webpBuffer),
      contentType: "image/webp",
    }),
    storage.upload({
      key: `${baseKey}.avif`,
      body: new Uint8Array(avifBuffer),
      contentType: "image/avif",
    }),
  ]);

  const usableWidths = VARIANT_WIDTHS.filter((w) => width === 0 || w < width);
  const variants = await Promise.all(
    usableWidths.map(async (w) => {
      const buffer = await image.clone().resize({ width: w }).webp({ quality: 78 }).toBuffer();
      const uploaded = await storage.upload({
        key: `${baseKey}-${w}w.webp`,
        body: new Uint8Array(buffer),
        contentType: "image/webp",
      });
      return { w, url: uploaded.url };
    }),
  );

  // ขนาดที่ใช้จริงบนหน้าเว็บคือไฟล์ WebP จึงเตือนจากตัวเลขนั้น ไม่ใช่ไฟล์ต้นฉบับ
  if (params.type === "poster" && webp.sizeBytes > 200 * 1024) {
    warnings.push(
      `ไฟล์ WebP ยังใหญ่ ${Math.round(webp.sizeBytes / 1024)} KB (ควรไม่เกิน 200 KB) — ` +
        "ลองย่อความกว้างของภาพต้นฉบับลงก่อนอัปโหลด",
    );
  }

  return {
    originalUrl: original.url,
    webpUrl: webp.url,
    avifUrl: avif.url,
    variants,
    width,
    height,
    sizeBytes: original.sizeBytes,
    mimeType: isPng ? "image/png" : "image/jpeg",
    warnings,
  };
}
