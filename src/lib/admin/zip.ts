import { deflateRawSync } from "node:zlib";

/**
 * ตัวสร้างไฟล์ ZIP ขนาดเล็ก
 *
 * เขียนเองเพราะไฟล์ .xlsx คือ ZIP ที่ข้างในเป็น XML
 * การเขียนเองประมาณ 100 บรรทัดนี้ทำให้ไม่ต้องเพิ่มไลบรารีภายนอกเข้ามาในระบบ
 * ซึ่งเป็นข้อได้เปรียบด้านความปลอดภัย (npm audit ต้องเป็น 0 ช่องโหว่)
 *
 * รองรับเท่าที่ .xlsx ต้องการเท่านั้น — ไม่รองรับ ZIP64 (ไฟล์เกิน 4 GB)
 * ซึ่งไม่มีทางเกิดกับไฟล์รายชื่อผู้ลงทะเบียน
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ buffer[i]!) & 0xff] ?? 0);
  }
  return (crc ^ -1) >>> 0;
}

export type ZipEntry = { name: string; content: string | Buffer };

export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  // ใช้เวลาคงที่แทนเวลาปัจจุบัน เพื่อให้ไฟล์เดิมได้ผลลัพธ์เหมือนเดิมทุกครั้ง
  const dosTime = 0;
  const dosDate = (2020 - 1980) << 9 | (1 << 5) | 1;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, "utf8");
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // ประกาศว่าชื่อไฟล์เป็น UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, end]);
}
