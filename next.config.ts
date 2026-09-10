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

          /**
           * บังคับให้เบราว์เซอร์ใช้ HTTPS เท่านั้นเป็นเวลา 1 ปี
           *
           * ป้องกันการดักกลางระหว่างทางตอนผู้ใช้พิมพ์ที่อยู่เว็บโดยไม่ใส่ https://
           * ซึ่งเป็นช่วงเดียวที่ข้อมูลยังวิ่งแบบไม่เข้ารหัส
           *
           * ⚠️ preload ต้องมั่นใจว่าโดเมนและโดเมนย่อยทั้งหมดใช้ HTTPS ได้จริง
           *    จึงยังไม่ใส่ไว้ ให้ผู้ดูแลเพิ่มเองเมื่อผูกโดเมนจริงเรียบร้อยแล้ว
           */
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },

          /**
           * จำกัดว่าหน้าเว็บโหลดอะไรได้บ้าง — ด่านสุดท้ายที่กัน XSS
           * ถ้ามีสคริปต์แปลกปลอมหลุดเข้ามาได้ เบราว์เซอร์จะไม่ยอมรันให้
           *
           * ⚠️ ต้องมี 'unsafe-inline' ในส่วน script
           *    เพราะ Next.js ฝังสคริปต์ hydration ไว้ในหน้าโดยตรง ถอดออกแล้วเว็บจะไม่ทำงาน
           *    ส่วน style ก็จำเป็นเพราะ Tailwind ใส่ style ตรงในบางกรณี
           *
           * frame-ancestors 'none' ทำงานร่วมกับ X-Frame-Options ข้างบน
           * เผื่อเบราว์เซอร์รุ่นที่รองรับอย่างใดอย่างหนึ่ง
           */
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.google.com",
              "frame-src https://www.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",

              /**
               * ⚠️ upgrade-insecure-requests ใส่ได้เฉพาะบนเครื่องจริงเท่านั้น
               *
               *    คำสั่งนี้บังคับให้ทุกคำขอเปลี่ยนจาก http เป็น https
               *    บนเครื่องพัฒนาที่รันด้วย http://localhost จึงเปลี่ยนไปหา https://localhost
               *    ซึ่งไม่มีอยู่จริง → คำขอล้มเงียบ ๆ โดยไม่มี error ให้เห็น
               *
               *    ผลที่ตามมาคือ service worker แคชหน้าเจ้าหน้าที่ไม่ได้เลย
               *    ทำให้ "โหมดออฟไลน์" ซึ่งเป็นฟีเจอร์สำคัญที่สุดของวันงาน
               *    ทดสอบบนเครื่องไม่ได้ และจะไปรู้ตัวเอาตอนอยู่หน้างานจริงที่เน็ตหลุด
               *
               *    บนเครื่องจริงเว็บเป็น https อยู่แล้ว จึงไม่มีผลข้างเคียง
               */
              ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
