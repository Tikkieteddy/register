import { createZip } from "./zip";

/**
 * สร้างไฟล์ส่งออก (หัวข้อ 3.4)
 *
 * ⚠️ CSV ต้องเป็น UTF-8 with BOM เสมอ
 *    ถ้าไม่มี BOM เมื่อเปิดใน Excel ภาษาไทยจะกลายเป็นตัวยึกยือทั้งไฟล์
 *    ซึ่งเป็นปัญหาที่เจอบ่อยที่สุดของการส่งออกข้อมูลภาษาไทย
 */

export type ExportColumn = { header: string; width: number };

/** ตัวนำหน้าไฟล์ที่บอก Excel ว่าเนื้อหาเป็น UTF-8 — ห้ามลบออก */
const UTF8_BOM = "\uFEFF";

export function toCsv(columns: ExportColumn[], rows: (string | number)[][]): Buffer {
  const escape = (value: string | number): string => {
    const text = String(value ?? "");
    // ห่อด้วยเครื่องหมายคำพูดเมื่อมีอักขระที่จะทำให้คอลัมน์เพี้ยน
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    columns.map((c) => escape(c.header)).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  return Buffer.from(`${UTF8_BOM}${lines.join("\r\n")}\r\n`, "utf8");
}

/* ------------------------------------------------------------------ */
/* Excel (.xlsx)                                                       */
/* ------------------------------------------------------------------ */

/** อักขระควบคุมทำให้ Excel ปฏิเสธไฟล์ทั้งไฟล์ จึงต้องตัดทิ้งก่อนเขียนลง XML */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(value: string): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * สร้างไฟล์ .xlsx โดยตรง
 *
 * ใช้ inlineStr แทน sharedStrings เพราะเขียนง่ายกว่ามาก และไฟล์รายชื่อ
 * มีข้อความซ้ำกันน้อย การใช้ sharedStrings จึงแทบไม่ช่วยลดขนาดไฟล์
 */
export function toXlsx(
  sheetName: string,
  columns: ExportColumn[],
  rows: (string | number)[][],
): Buffer {
  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("");

  const cell = (rowIndex: number, colIndex: number, value: string | number, style: number) => {
    const ref = `${columnName(colIndex)}${rowIndex}`;
    if (typeof value === "number" && Number.isFinite(value)) {
      return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
      String(value ?? ""),
    )}</t></is></c>`;
  };

  const headerRow = `<row r="1">${columns.map((c, i) => cell(1, i, c.header, 1)).join("")}</row>`;

  const bodyRows = rows
    .map(
      (row, r) =>
        `<row r="${r + 2}">${row.map((value, i) => cell(r + 2, i, value, 0)).join("")}</row>`,
    )
    .join("");

  const lastColumn = columnName(Math.max(columns.length - 1, 0));

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${headerRow}${bodyRows}</sheetData>
<autoFilter ref="A1:${lastColumn}${rows.length + 1}"/>
</worksheet>`;

  // ฟอนต์ Tahoma เพื่อให้สระและวรรณยุกต์ไทยแสดงถูกตำแหน่งใน Excel บน Windows
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Tahoma"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEC5F27"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return createZip([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);
}
