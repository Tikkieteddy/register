/**
 * ประกาศชนิดของไฟล์ที่ import แบบ side-effect (ไม่ใช่โมดูล TypeScript)
 *
 * จำเป็นสำหรับ TypeScript 6 ขึ้นไป ซึ่งเข้มงวดกับการ import ไฟล์ที่ไม่มี type declaration
 * (error TS2882) — Next.js เป็นตัวจัดการไฟล์เหล่านี้ตอน build อยู่แล้ว
 */
declare module "*.css";
declare module "*.scss";

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
