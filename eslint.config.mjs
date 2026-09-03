import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * ใช้ flat config ของ eslint-config-next โดยตรง
 * ไม่ผ่าน FlatCompat เพราะ `next lint` ถูกยกเลิกใน Next.js 16 แล้ว
 */
const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts"],
  },
  {
    rules: {
      // บังคับให้ import type แยกจาก import ค่า ทำให้ bundle เล็กลงและอ่านง่ายขึ้น
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // ตัวแปรที่ตั้งใจไม่ใช้ ให้ขึ้นต้นด้วย _ แทนการปิด rule ทิ้ง
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
