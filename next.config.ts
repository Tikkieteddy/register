import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // บังคับให้ build ล้มถ้ามี type error หรือ lint error — กันโค้ดเสียหลุดขึ้น production
  typescript: { ignoreBuildErrors: false },
  // ESLint รันเป็นขั้นตอนแยกใน CI (`npm run lint`) เพราะ `next lint` ถูกยกเลิกใน Next 16
  eslint: { ignoreDuringBuilds: true },
  images: {
    // ตามข้อกำหนด E3: เสิร์ฟรูปเป็น WebP/AVIF พร้อม responsive srcset
    formats: ["image/avif", "image/webp"],
    deviceSizes: [400, 640, 828, 1080, 1200, 1920],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
